export const ZOOM_MAX_SESSION_NAME_LENGTH = 200;
export const ZOOM_MAX_SESSION_KEY_LENGTH = 36;
export const ZOOM_MAX_USER_IDENTITY_LENGTH = 35;

function toSafeString(value) {
  return String(value || '').trim();
}

function stripUnsafeCharacters(value, pattern = /[^a-zA-Z0-9_-]/g) {
  return toSafeString(value).replace(pattern, '');
}

export function buildZoomSessionName(consulta) {
  const explicitName = toSafeString(consulta?.sala_id);

  if (explicitName) {
    return explicitName.slice(0, ZOOM_MAX_SESSION_NAME_LENGTH);
  }

  const consultaId = toSafeString(consulta?.id);
  return `consulta-${consultaId}`.slice(0, ZOOM_MAX_SESSION_NAME_LENGTH);
}

export function buildZoomSessionKey(consulta) {
  const explicitKey = stripUnsafeCharacters(consulta?.token_sala);

  if (explicitKey) {
    return explicitKey.slice(0, ZOOM_MAX_SESSION_KEY_LENGTH);
  }

  const consultaId = stripUnsafeCharacters(toSafeString(consulta?.id), /[^a-zA-Z0-9]/g);
  return consultaId.slice(0, ZOOM_MAX_SESSION_KEY_LENGTH);
}

export function buildZoomUserIdentity({ userId, participantRole }) {
  const prefix = participantRole === 'professional' ? 'pr-' : 'pt-';
  const sanitizedUserId = stripUnsafeCharacters(userId, /[^a-zA-Z0-9]/g).slice(0, 32);
  return `${prefix}${sanitizedUserId}`.slice(0, ZOOM_MAX_USER_IDENTITY_LENGTH);
}

export function buildZoomDisplayName({ user, participantRole, consulta }) {
  const fallbackName = participantRole === 'professional'
    ? consulta?.profissional_nome
    : consulta?.paciente_nome;

  return toSafeString(user?.full_name || fallbackName || 'Participante').slice(0, 64);
}

export function getZoomSdkRole(participantRole) {
  return participantRole === 'professional' ? 1 : 0;
}

export function buildConsultaRoomPayload(consultaId, consulta = {}) {
  const roomSeed = {
    id: consultaId,
    sala_id: consulta?.sala_id,
    token_sala: consulta?.token_sala,
  };

  return {
    sala_id: buildZoomSessionName(roomSeed),
    token_sala: buildZoomSessionKey(roomSeed),
  };
}
