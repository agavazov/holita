import { ServiceUnavailableException } from '@nestjs/common';

export interface ProfileObservation {
  messageId: string;
  eventTimeUtc: string;
  rawMessage: string;
  configurationId: string;
  messageNumber: number;
  lastMessage: boolean;
  profileId: number;
}

export interface ProfileReadback {
  status: 'ABSENT' | 'INCOMPLETE' | 'CONFLICT' | 'COMPLETE';
  profileId: number | null;
}

export function profileObservation(
  messageId: string,
  eventTimeUtc: string,
  rawMessage: string,
): ProfileObservation | null {
  if (!/^19,0,416,/.test(rawMessage)) {
    return null;
  }
  const fields = /^19,0,416,0,([01]),([1-9]\d{0,3}),(0|[1-9]\d{0,4}),1F([a-f\d]{4})$/i.exec(
    rawMessage,
  );
  if (
    !fields ||
    fields[3] === undefined ||
    Number(fields[2]) > 1000 ||
    Number(fields[3]) > 65535 ||
    fields[4] === undefined
  ) {
    throw new ServiceUnavailableException('Karma profile observations are unavailable');
  }
  return {
    messageId,
    eventTimeUtc,
    rawMessage,
    configurationId: fields[3],
    messageNumber: Number(fields[2]),
    lastMessage: fields[1] === '1',
    profileId: Number.parseInt(fields[4], 16),
  };
}

export function profileReadback(
  observations: ProfileObservation[],
  coverageComplete: boolean,
): ProfileReadback {
  const first = observations[0];
  if (!first) {
    return { status: 'ABSENT', profileId: null };
  }
  if (
    observations.some(
      (item) =>
        item.profileId !== first.profileId ||
        item.configurationId !== first.configurationId ||
        item.messageNumber !== first.messageNumber ||
        item.lastMessage !== first.lastMessage,
    )
  ) {
    return { status: 'CONFLICT', profileId: null };
  }
  if (!coverageComplete || first.messageNumber !== 1 || !first.lastMessage) {
    return { status: 'INCOMPLETE', profileId: null };
  }
  return { status: 'COMPLETE', profileId: first.profileId };
}
