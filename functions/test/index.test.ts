import * as admin from "firebase-admin";
import { createAtendimento, updateAtendimentoStatus } from "../src/index"

// Garante um único app inicializado apontando para o emulador
// (FIRESTORE_EMULATOR_HOST é definido no script "npm test").
if (admin.apps.length === 0) {
  admin.initializeApp({ projectId: "atendeai-teste-local" });
}

const db = admin.firestore();

describe("modelo de dados básico", () => {
  afterAll(async () => {
    await admin.app().delete();
  });

  it("permite gravar e ler um atendimento de um tenant", async () => {
    const ref = await db.collection("atendimentos").add({
      tenantId: "tenant-teste",
      transcricao: "teste automatizado",
      status: "novo",
    });

    const snapshot = await ref.get();

    expect(snapshot.exists).toBe(true);
    expect(snapshot.data()?.tenantId).toBe("tenant-teste");
  });

  it("recusa atendimento com prioridade inválida sem gravar no banco", async () => {
    const before = await db.collection("atendimentos").get();

    await expect(
      createAtendimento.run({
        data: {
          tenantId: "tenant-teste",
          transcricao: "teste de prioridade inválida",
          duracaoSegundos: 100,
          prioridade: "urgente",
        },
        rawRequest: {} as any,
      })
    ).rejects.toThrow("prioridade deve ser");

    const after = await db.collection("atendimentos").get();

    expect(after.size).toBe(before.size);
  });

  it("atualiza o status quando o atendimento pertence ao tenant informado", async () => {
  const ref = await db.collection("atendimentos").add({
    tenantId: "tenant-alfa",
    transcricao: "teste de atualização",
    status: "novo",
  });

  await expect(
    updateAtendimentoStatus.run({
      data: {
        atendimentoId: ref.id,
        tenantId: "tenant-alfa",
        novoStatus: "resolvido",
      },
      rawRequest: {} as any,
    })
  ).resolves.toEqual({ ok: true });

  const snapshot = await ref.get();

  expect(snapshot.data()?.status).toBe("resolvido");
});

it("recusa atualização de atendimento pertencente a outro tenant", async () => {
  const ref = await db.collection("atendimentos").add({
    tenantId: "tenant-alfa",
    transcricao: "teste de isolamento",
    status: "novo",
  });

  await expect(
    updateAtendimentoStatus.run({
      data: {
        atendimentoId: ref.id,
        tenantId: "tenant-beta",
        novoStatus: "resolvido",
      },
      rawRequest: {} as any,
    })
  ).rejects.toThrow("Atendimento não pertence ao tenant informado.");

  const snapshot = await ref.get();

  expect(snapshot.data()?.status).toBe("novo");
});
});
