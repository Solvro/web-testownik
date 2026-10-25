/** `mm:ss`, or `h:mm:ss` from the first hour on. */
export const formatStudyTime = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedMinutes = String(minutes).padStart(2, "0");
  const paddedSeconds = String(seconds).padStart(2, "0");

  if (hours === 0) {
    return `${paddedMinutes}:${paddedSeconds}`;
  }

  return `${String(hours)}:${paddedMinutes}:${paddedSeconds}`;
};
