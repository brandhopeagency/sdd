export function logResilience(event: string, details: Record<string, unknown>): void {
  console.log(JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    ...details,
  }));
}
