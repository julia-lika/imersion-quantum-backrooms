import os
import random
import time
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel, Field

import quantum_circuit as qc

QUBITS = qc.QUBITS
DEFAULT_SHOTS = 128
MIN_INTERVAL_SECONDS = float(os.getenv("IBM_MIN_INTERVAL_SECONDS", "12"))

app = FastAPI(title="Quantum Backrooms Quantum API")
last_job_at = 0.0
cached_result: dict[str, Any] | None = None
cached_floor: int | None = None


class MeasurementRequest(BaseModel):
    shots: int = Field(default=DEFAULT_SHOTS, ge=32, le=512)
    floor: int = Field(default=1, ge=1, le=99)


def pick_bitstring(counts: dict[str, int]) -> str:
    return random.choices(list(counts), weights=list(counts.values()), k=1)[0]


def local_measurement(shots: int, floor: int) -> dict[str, Any]:
    # Mesmo circuito do QPU, simulado de forma exata: distribuição não uniforme.
    counts = qc.sample_counts(floor, shots)
    return {
        "bitstring": pick_bitstring(counts),
        "counts": counts,
        "source": "local-sim",
        "backend": "python-statevector",
        "job_id": None,
        "shots": shots,
        "floor": floor,
        "entropy_bits": round(qc.shannon_entropy(counts), 4),
    }


def ibm_measurement(shots: int, floor: int) -> dict[str, Any]:
    from qiskit.transpiler import generate_preset_pass_manager
    from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2

    token = os.getenv("IBM_QUANTUM_API_KEY")
    if not token:
        return local_measurement(shots, floor)

    instance = os.getenv("IBM_QUANTUM_INSTANCE") or None
    backend_name = os.getenv("IBM_QUANTUM_BACKEND") or None
    service = QiskitRuntimeService(
        channel="ibm_quantum_platform",
        token=token,
        instance=instance,
    )
    backend = service.backend(backend_name) if backend_name else service.least_busy(
        operational=True,
        simulator=False,
        min_num_qubits=QUBITS,
    )

    circuit = qc.build_qiskit_circuit(floor)
    pass_manager = generate_preset_pass_manager(backend=backend, optimization_level=1)
    isa_circuit = pass_manager.run(circuit)
    sampler = SamplerV2(mode=backend)
    job = sampler.run([(isa_circuit,)], shots=shots)
    result = job.result()
    raw_counts = result[0].data.meas.get_counts()

    counts: dict[str, int] = {}
    for key, value in raw_counts.items():
        bits = qc.qiskit_key_to_game_bits(key)
        counts[bits] = counts.get(bits, 0) + value

    return {
        "bitstring": pick_bitstring(counts),
        "counts": counts,
        "source": "ibm-qpu",
        "backend": backend.name,
        "job_id": job.job_id(),
        "shots": shots,
        "floor": floor,
        "entropy_bits": round(qc.shannon_entropy(counts), 4),
    }


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "mode": "ibm-qpu" if os.getenv("IBM_QUANTUM_API_KEY") else "local-sim"}


@app.post("/api/measure")
def measure(request: MeasurementRequest) -> dict[str, Any]:
    global cached_result, cached_floor, last_job_at

    now = time.monotonic()
    if (
        cached_result
        and cached_floor == request.floor
        and now - last_job_at < MIN_INTERVAL_SECONDS
    ):
        # Reaproveita os counts do andar, mas sorteia nova amostra: cada medição continua "viva".
        return {**cached_result, "bitstring": pick_bitstring(cached_result["counts"]), "cached": True}

    try:
        result = ibm_measurement(request.shots, request.floor)
    except Exception as error:  # Keep the game playable when a QPU job fails.
        result = local_measurement(request.shots, request.floor)
        result["fallback_reason"] = error.__class__.__name__

    cached_result = result
    cached_floor = request.floor
    last_job_at = now
    return {**result, "cached": False}
