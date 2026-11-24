#!/usr/bin/env python3
"""Gera o banco de medições quânticas usado pelo jogo (src/data/quantum-bank.json).

O jogo sorteia amostras destes `counts` em tempo de execução, sem depender da
fila ou da cota da IBM. O campo `source` diz a verdade sobre a origem:

  local-sim  simulador exato em Python (padrão, sem credenciais)
  ibm-qpu    hardware real da IBM (requer IBM_QUANTUM_API_KEY e qiskit-ibm-runtime)

No GitHub: Actions > "Medir no computador quântico (IBM)" > Run workflow.

Exemplos:
  python3 tools/pregen.py                       # 5 andares, simulador
  python3 tools/pregen.py --backend ibm         # 5 andares num job só, QPU real
  python3 tools/pregen.py --job-id <ID>         # baixa um job IBM já enviado
  python3 tools/pregen.py --floors 5 --shots 1024 --seed 7
"""

from __future__ import annotations

import argparse
import json
import math
import os
import random
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

import quantum_circuit as qc  # noqa: E402


def local_entry(floor: int, shots: int, rng: random.Random) -> dict:
    return {
        "source": "local-sim",
        "backend": "python-statevector",
        "job_id": None,
        "counts": qc.sample_counts(floor, shots, rng),
    }


def _ibm_service():
    from qiskit_ibm_runtime import QiskitRuntimeService

    token = os.getenv("IBM_QUANTUM_API_KEY")
    if not token:
        raise SystemExit("Defina IBM_QUANTUM_API_KEY para usar --backend ibm.")
    return QiskitRuntimeService(
        channel="ibm_quantum_platform",
        token=token,
        instance=os.getenv("IBM_QUANTUM_INSTANCE") or None,
    )


def _game_counts(raw: dict[str, int]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for key, value in raw.items():
        bits = qc.qiskit_key_to_game_bits(key)
        counts[bits] = counts.get(bits, 0) + value
    return dict(sorted(counts.items()))


def _ibm_entries_from_job(job, floors: list[int], extra: dict | None = None) -> dict[int, dict]:
    result = job.result()
    backend_name = job.backend().name
    created = getattr(job, "creation_date", None)
    executed_at = (created.astimezone(timezone.utc) if created else datetime.now(timezone.utc))
    entries = {}
    for index, floor in enumerate(floors):
        entries[floor] = {
            "source": "ibm-qpu",
            "backend": backend_name,
            "job_id": job.job_id(),
            "executed_at": executed_at.isoformat(timespec="seconds"),
            **((extra or {}).get(floor, {})),
            "counts": _game_counts(result[index].data.meas.get_counts()),
        }
    return entries


def ibm_entries(floors: list[int], shots: int) -> dict[int, dict]:
    """Manda TODOS os andares num único job (um PUB por andar): uma fila só, menos cota."""
    from qiskit.transpiler import generate_preset_pass_manager
    from qiskit_ibm_runtime import SamplerV2

    service = _ibm_service()
    name = os.getenv("IBM_QUANTUM_BACKEND") or None
    backend = service.backend(name) if name else service.least_busy(
        operational=True, simulator=False, min_num_qubits=qc.QUBITS
    )
    print(f"backend: {backend.name} ({backend.num_qubits} qubits)", flush=True)

    pass_manager = generate_preset_pass_manager(backend=backend, optimization_level=1)
    isa_circuits, extra = [], {}
    for floor in floors:
        isa = pass_manager.run(qc.build_qiskit_circuit(floor))
        isa_circuits.append(isa)
        ops = isa.count_ops()
        extra[floor] = {
            "transpiled_depth": isa.depth(),
            "two_qubit_gates": sum(ops.get(g, 0) for g in ("cz", "ecr", "cx")),
        }

    job = SamplerV2(mode=backend).run([(isa,) for isa in isa_circuits], shots=shots)
    print(f"job enviado: {job.job_id()} (aguardando a fila da IBM...)", flush=True)
    return _ibm_entries_from_job(job, floors, extra)


def ibm_entries_from_job_id(job_id: str, floors: list[int]) -> dict[int, dict]:
    """Recupera um job já enviado (ex.: o workflow expirou enquanto esperava a fila)."""
    job = _ibm_service().job(job_id)
    print(f"job {job_id}: status {job.status()}", flush=True)
    return _ibm_entries_from_job(job, floors)


def hellinger_fidelity(counts: dict[str, int], floor: int) -> float:
    """Quão perto as medições estão da distribuição ideal (1 = idêntica). Mede o ruído do hardware."""
    total = sum(counts.values())
    probs = qc.probabilities(floor)
    bc = 0.0
    for bits, value in counts.items():
        index = sum(1 << q for q, ch in enumerate(bits) if ch == "1")
        bc += math.sqrt(value / total * probs[index])
    return bc * bc


def build_bank(floors: int, shots: int, backend: str, seed: int | None, job_id: str | None = None) -> dict:
    rng = random.Random(seed)
    floor_list = list(range(1, floors + 1))

    if job_id:
        raws = ibm_entries_from_job_id(job_id, floor_list)
    elif backend == "ibm":
        raws = ibm_entries(floor_list, shots)
    else:
        raws = {floor: local_entry(floor, shots, rng) for floor in floor_list}

    entries = []
    for floor in floor_list:
        raw = raws[floor]
        params = qc.circuit_params(floor)
        entries.append({
            "floor": floor,
            "shots": sum(raw["counts"].values()),
            "params": {key: [round(v, 6) for v in values] for key, values in params.items()},
            "entropy_bits": round(qc.shannon_entropy(raw["counts"]), 4),
            "ideal_entropy_bits": round(qc.ideal_entropy(floor), 4),
            "fidelity_vs_ideal": round(hellinger_fidelity(raw["counts"], floor), 4),
            **raw,
        })

    return {
        "version": 1,
        "qubits": qc.QUBITS,
        "bit_order": "qubit0-first",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": entries[0]["source"],
        "backend": entries[0]["backend"],
        "job_id": entries[0].get("job_id"),
        "entries": entries,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--floors", type=int, default=5)
    parser.add_argument("--shots", type=int, default=1024)
    parser.add_argument("--backend", choices=["local", "ibm"], default="local")
    parser.add_argument("--job-id", default=None, help="recupera os resultados de um job IBM já enviado")
    parser.add_argument("--seed", type=int, default=None, help="semente do simulador (reprodutível)")
    parser.add_argument("--out", type=Path, default=ROOT / "src" / "data" / "quantum-bank.json")
    args = parser.parse_args()

    bank = build_bank(args.floors, args.shots, args.backend, args.seed, args.job_id)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(bank, indent=1) + "\n", encoding="utf-8")
    print(f"gravado: {args.out} ({len(bank['entries'])} andares)")


if __name__ == "__main__":
    main()
