"""Rodar a partir de backend/:  python3 -m unittest discover -s tests -v"""

import math
import os
import random
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import quantum_circuit as qc  # noqa: E402


class QuantumCircuitTest(unittest.TestCase):
    def test_distribuicao_normalizada(self):
        for floor in (1, 3, 5):
            self.assertAlmostEqual(sum(qc.probabilities(floor)), 1.0, places=9)

    def test_nao_e_uniforme(self):
        # O circuito antigo (H + CZ) dava 12 bits de entropia, uniforme exato.
        for floor in range(1, 6):
            self.assertLess(qc.ideal_entropy(floor), qc.QUBITS - 1.0, f"andar {floor}")

    def test_andares_tem_distribuicoes_diferentes(self):
        self.assertNotEqual(qc.probabilities(1), qc.probabilities(2))

    def test_deterministico_por_andar(self):
        self.assertEqual(qc.circuit_params(2), qc.circuit_params(2))
        self.assertEqual(qc.probabilities(2), qc.probabilities(2))

    def test_amostras_sao_bitstrings_validos(self):
        counts = qc.sample_counts(1, 256, random.Random(1))
        self.assertEqual(sum(counts.values()), 256)
        for bits in counts:
            self.assertEqual(len(bits), qc.QUBITS)
            self.assertTrue(set(bits) <= {"0", "1"})

    def test_amostragem_reprodutivel_com_semente(self):
        a = qc.sample_counts(1, 128, random.Random(9))
        b = qc.sample_counts(1, 128, random.Random(9))
        self.assertEqual(a, b)

    def test_ordem_dos_bits(self):
        self.assertEqual(qc.index_to_game_bits(1), "1" + "0" * 11)  # qubit 0 primeiro
        self.assertEqual(qc.qiskit_key_to_game_bits("0" * 11 + "1"), "1" + "0" * 11)
        self.assertEqual(qc.qiskit_key_to_game_bits("1" + "0" * 11), "0" * 11 + "1")

    def test_entropia_da_amostra_proxima_da_ideal(self):
        counts = qc.sample_counts(1, 20000, random.Random(3))
        self.assertLess(abs(qc.shannon_entropy(counts) - qc.ideal_entropy(1)), 0.25)

    def test_correlacao_entre_qubits_vizinhos(self):
        # Marginais independentes teriam P(q0=1,q1=1) = P(q0=1)P(q1=1); a cadeia de CX quebra isso.
        probs = qc.probabilities(1)
        p0 = sum(p for i, p in enumerate(probs) if i & 1)
        p1 = sum(p for i, p in enumerate(probs) if i >> 1 & 1)
        p01 = sum(p for i, p in enumerate(probs) if i & 1 and i >> 1 & 1)
        self.assertGreater(abs(p01 - p0 * p1), 0.005)
        self.assertTrue(math.isfinite(p01))


if __name__ == "__main__":
    unittest.main()
