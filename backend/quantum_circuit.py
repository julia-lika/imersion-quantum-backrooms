"""Circuito quântico por andar do Quantum Backrooms.

O circuito antigo (H em todos os qubits + anel de CZ) produz distribuição
exatamente uniforme: CZ é diagonal e não altera as probabilidades na base Z.
Este módulo define um circuito cuja distribuição NÃO é uniforme e tem
correlações entre qubits vizinhos, para que o resultado realmente molde o mapa.

Convenção de bits: no `bitstring` do jogo, o caractere i é o qubit i
(qubit 0 primeiro). O Qiskit devolve o qubit 0 por último; use
`qiskit_key_to_game_bits` ao ler counts de um backend real.

Estrutura (por andar):
  1. RY(theta_i)  em todos os qubits  -> viés por região
  2. CX(i, i+1)   em cadeia           -> correlação entre vizinhos
  3. RY(phi_i)    em todos os qubits  -> interferência
  4. CZ(i, i+1)   em anel             -> fase relativa entre regiões
  5. RY(psi_i)    pequenos            -> quebra de simetria residual

O simulador abaixo é puro Python (sem numpy/qiskit), exato, e usa a mesma
sequência de portas de `build_qiskit_circuit`.
"""

from __future__ import annotations

import math
import random
from collections import Counter

QUBITS = 12
STATES = 1 << QUBITS


def circuit_params(floor: int) -> dict[str, list[float]]:
    """Ângulos determinísticos por andar (mesmo andar, mesmo circuito)."""
    rng = random.Random(f"quantum-backrooms:floor:{floor}")
    return {
        "theta": [math.pi * (0.12 + 0.76 * rng.random()) for _ in range(QUBITS)],
        "phi": [math.pi * (0.05 + 0.40 * rng.random()) for _ in range(QUBITS)],
        "psi": [math.pi * 0.10 * rng.random() for _ in range(QUBITS)],
    }


def _ry(amps: list[float], qubit: int, angle: float) -> None:
    cos, sin = math.cos(angle / 2), math.sin(angle / 2)
    mask = 1 << qubit
    for i in range(STATES):
        if not i & mask:
            j = i | mask
            a0, a1 = amps[i], amps[j]
            amps[i] = cos * a0 - sin * a1
            amps[j] = sin * a0 + cos * a1


def _cx(amps: list[float], control: int, target: int) -> None:
    control_mask, target_mask = 1 << control, 1 << target
    for i in range(STATES):
        if i & control_mask and not i & target_mask:
            j = i | target_mask
            amps[i], amps[j] = amps[j], amps[i]


def _cz(amps: list[float], a: int, b: int) -> None:
    mask = (1 << a) | (1 << b)
    for i in range(STATES):
        if i & mask == mask:
            amps[i] = -amps[i]


def probabilities(floor: int) -> list[float]:
    """Distribuição exata (índice = inteiro cujo bit q é o qubit q)."""
    params = circuit_params(floor)
    amps = [0.0] * STATES
    amps[0] = 1.0

    for q in range(QUBITS):
        _ry(amps, q, params["theta"][q])
    for q in range(QUBITS - 1):
        _cx(amps, q, q + 1)
    for q in range(QUBITS):
        _ry(amps, q, params["phi"][q])
    for q in range(QUBITS):
        _cz(amps, q, (q + 1) % QUBITS)
    for q in range(QUBITS):
        _ry(amps, q, params["psi"][q])

    return [a * a for a in amps]


def index_to_game_bits(index: int) -> str:
    """Inteiro -> bitstring do jogo (caractere i = qubit i)."""
    return "".join("1" if index >> q & 1 else "0" for q in range(QUBITS))


def qiskit_key_to_game_bits(key: str) -> str:
    """Chave de counts do Qiskit (qubit 0 à direita) -> bitstring do jogo."""
    bits = key.replace(" ", "")[-QUBITS:]
    return bits[::-1]


def sample_counts(floor: int, shots: int, rng: random.Random | None = None) -> dict[str, int]:
    rng = rng or random.Random()
    probs = probabilities(floor)
    picks = rng.choices(range(STATES), weights=probs, k=shots)
    counts = Counter(index_to_game_bits(i) for i in picks)
    return dict(sorted(counts.items()))


def shannon_entropy(counts: dict[str, int]) -> float:
    total = sum(counts.values())
    return -sum(c / total * math.log2(c / total) for c in counts.values() if c > 0)


def ideal_entropy(floor: int) -> float:
    return -sum(p * math.log2(p) for p in probabilities(floor) if p > 0)


def build_qiskit_circuit(floor: int):
    """Mesmo circuito em Qiskit, para rodar em QPU real."""
    from qiskit import QuantumCircuit

    params = circuit_params(floor)
    circuit = QuantumCircuit(QUBITS)
    for q in range(QUBITS):
        circuit.ry(params["theta"][q], q)
    for q in range(QUBITS - 1):
        circuit.cx(q, q + 1)
    for q in range(QUBITS):
        circuit.ry(params["phi"][q], q)
    for q in range(QUBITS):
        circuit.cz(q, (q + 1) % QUBITS)
    for q in range(QUBITS):
        circuit.ry(params["psi"][q], q)
    circuit.measure_all()
    return circuit
