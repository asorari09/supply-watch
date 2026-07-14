export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

export const fixedClock = (instant: Date | string): Clock => {
  const fixedInstant =
    typeof instant === "string"
      ? new Date(instant)
      : new Date(instant.getTime());

  return {
    now: () => new Date(fixedInstant.getTime()),
  };
};
