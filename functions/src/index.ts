import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "./admin";

/**
 * Function de exemplo — só para você confirmar que o ambiente está rodando.
 */
export const ping = onCall(() => {
  return { ok: true, message: "pong" };
});

/**
 * Lista os atendimentos de UM tenant.
 *
 * ATENÇÃO: esta função hoje recebe o tenantId diretamente no payload da
 * chamada, sem validar se quem está chamando de fato pertence a esse tenant.
 * Isso é proposital — faz parte do que os testes técnicos pedem para revisar,
 * dependendo do nível do teste que você recebeu.
 */
export const listAtendimentos = onCall(async (request) => {
  const tenantId = request.data?.tenantId;

  if (!tenantId || typeof tenantId !== "string") {
    throw new HttpsError("invalid-argument", "tenantId é obrigatório.");
  }

  const snapshot = await db
    .collection("atendimentos")
    .where("tenantId", "==", tenantId)
    .get();

  return {
    atendimentos: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
  };
});

/**
 * Cria um novo registro de atendimento para um tenant.
 * Implementação mínima — sem validação de schema.
 */
export const createAtendimento = onCall(async (request) => {
  const {
    tenantId,
    transcricao,
    duracaoSegundos,
    prioridade = "media",
  } = request.data ?? {};

  if (!tenantId || typeof tenantId !== "string") {
    throw new HttpsError("invalid-argument", "tenantId é obrigatório.");
  }

  if (
    prioridade !== "baixa" &&
    prioridade !== "media" &&
    prioridade !== "alta"
  ) {
    throw new HttpsError(
      "invalid-argument",
      'prioridade deve ser "baixa", "media" ou "alta".'
    );
  }

  const doc = await db.collection("atendimentos").add({
    tenantId,
    transcricao: transcricao ?? "",
    duracaoSegundos: duracaoSegundos ?? 0,
    prioridade,
    status: "novo",
    criadoEm: new Date().toISOString(),
  });

  return { id: doc.id };
});

export const updateAtendimentoStatus = onCall(async (request) => {
  const { atendimentoId, tenantId, novoStatus } = request.data ?? {};

  if (!atendimentoId || typeof atendimentoId !== "string") {
    throw new HttpsError("invalid-argument", "atendimentoId é obrigatório.");
  }

  if (!tenantId || typeof tenantId !== "string") {
    throw new HttpsError("invalid-argument", "tenantId é obrigatório.");
  }

  if (
    novoStatus !== "novo" &&
    novoStatus !== "pendente" &&
    novoStatus !== "resolvido"
  ) {
    throw new HttpsError(
      "invalid-argument",
      'novoStatus deve ser "novo", "pendente" ou "resolvido".'
    );
  }

  const atendimentoRef = db.collection("atendimentos").doc(atendimentoId);
  const atendimento = await atendimentoRef.get();

  if (!atendimento.exists) {
    throw new HttpsError("not-found", "Atendimento não encontrado.");
  }

  const data = atendimento.data();

  if (data?.tenantId !== tenantId) {
    throw new HttpsError(
      "permission-denied",
      "Atendimento não pertence ao tenant informado."
    );
  }

  await atendimentoRef.update({
    status: novoStatus,
  });

  return { ok: true };
});
