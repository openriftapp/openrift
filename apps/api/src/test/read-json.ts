export type JsonBody = any;

export async function readJson<T = JsonBody>(res: Response): Promise<T> {
  return (await res.json()) as T;
}
