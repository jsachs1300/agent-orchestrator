declare module "redis" {
  export type RedisClientType = {
    connect(): Promise<void>;
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    hSet(key: string, field: string, value: string): Promise<void>;
    hVals(key: string): Promise<string[]>;
    hDel(key: string, field: string): Promise<void>;
    on?(event: string, listener: (...args: any[]) => void): void;
  };

  export function createClient(options?: any): RedisClientType;
}
