#!/usr/bin/env python3
"""Gera o banco de medições quânticas usado pelo jogo (site/data/quantum-bank.json).

O jogo sorteia amostras destes `counts` em tempo de execução, sem depender da
fila ou da cota da IBM. O campo `source` diz a verdade sobre a origem:

  local-sim  simulador exato em Python (padrão, sem credenciais)
  ibm-qpu    hardware real da IBM (requer IBM_QUANTUM_API_KEY e qiskit-ibm-runtime)

Exemplos:
  python3 tools/pregen.py                       # 5 andares, simulador
  python3 tools/pregen.py --backend ibm         # 5 andares, QPU real
  python3 tools/pregen.py --floors 5 --shots 1024 --seed 7
"""

from __future__ import annotations

import argparse
import json
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


def ibm_entry(floor: int, shots: int) -> dict:
    from qiskit.transpiler import generate_preset_pass_manager
    from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2

    token = os.getenv("IBM_QUANTUM_API_KEY")
    if not token:
        raise SystemExit("Defina IBM_QUANTUM_API_KEY para usar --backend ibm.")

    service = QiskitRuntimeService(
        channel="ibm_quantum_platform",
        token=token,
        instance=os.getenv("IBM_QUANTUM_INSTANCE") or None,
    )
    name = os.getenv("IBM_QUANTUM_BACKEND") or None
    backend = service.backend(name) if name else service.least_busy(
        operational=True, simulator=False, min_num_qubits=qc.QUBITS
    )

    circuit = qc.build_qiskit_circuit(floor)
    isa = generate_preset_pass_manager(backend=backend, optimization_level=1).run(circuit)
    job = SamplerV2(mode=backend).run([(isa,)], shots=shots)
    raw = job.result()[0].data.meas.get_counts()

    counts: dict[str, int] = {}
    for key, value in raw.items():
        bits = qc.qiskit_key_to_game_bits(key)
        counts[bits] = counts.get(bits, 0) + value

    return {
        "source": "ibm-qpu",
        "backend": backend.name,
        "job_id": job.job_id(),
        "counts": dict(sorted(counts.items())),
    }


def build_bank(floors: int, shots: int, backend: str, seed: int | None) -> dict:
    rng = random.Random(seed)
    entries = []

    for floor in range(1, floors + 1):
        print(f"andar {floor}/{floors} ({backend})...", flush=True)
        raw = local_entry(floor, shots, rng) if backend == "local" else ibm_entry(floor, shots)
        params = qc.circuit_params(floor)
        entries.append({
            "floor": floor,
            "shots": sum(raw["counts"].values()),
            "params": {key: [round(v, 6) for v in values] for key, values in params.items()},
            "entropy_bits": round(qc.shannon_entropy(raw["counts"]), 4),
            "ideal_entropy_bits": round(qc.ideal_entropy(floor), 4),
            **raw,
        })

    return {
        "version": 1,
        "qubits": qc.QUBITS,
        "bit_order": "qubit0-first",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "entries": entries,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--floors", type=int, default=5)
    parser.add_argument("--shots", type=int, default=1024)
    parser.add_argument("--backend", choices=["local", "ibm"], default="local")
    parser.add_argument("--seed", type=int, default=None, help="semente do simulador (reprodutível)")
    parser.add_argument("--out", type=Path, default=ROOT / "site" / "data" / "quantum-bank.json")
    args = parser.parse_args()

    bank = build_bank(args.floors, args.shots, args.backend, args.seed)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(bank, indent=1) + "\n", encoding="utf-8")
    print(f"gravado: {args.out} ({len(bank['entries'])} andares)")


if __name__ == "__main__":
    main()
