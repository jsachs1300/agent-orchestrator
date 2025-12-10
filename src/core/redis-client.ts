import net from "node:net";
import tls from "node:tls";

export interface RedisConnectionOptions {
  host: string;
  port: number;
  username?: string;
  password?: string;
  useTls?: boolean;
}

type SocketType = net.Socket | tls.TLSSocket;

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
};

export class RedisConnection {
  private socket: SocketType;
  private buffer = "";
  private readonly pending: PendingRequest[] = [];

  private constructor(socket: SocketType) {
    this.socket = socket;
    this.socket.on("data", (data) => this.onData(data));
    this.socket.on("error", (err) => {
      if (this.pending.length) {
        const next = this.pending.shift();
        next?.reject(err);
      } else {
        console.error("Redis connection error", err);
      }
    });
  }

  static async connect(options: RedisConnectionOptions): Promise<RedisConnection> {
    const socket = options.useTls
      ? tls.connect({ host: options.host, port: options.port })
      : net.createConnection({ host: options.host, port: options.port });

    await new Promise<void>((resolve, reject) => {
      const successEvent = options.useTls ? "secureConnect" : "connect";

      const onConnect = () => {
        socket.off("error", onError);
        resolve();
      };

      const onError = (err: Error) => {
        socket.off(successEvent, onConnect);
        reject(err);
      };

      socket.once(successEvent, onConnect);
      socket.once("error", onError);
    });

    const connection = new RedisConnection(socket);

    if (options.password) {
      const authArgs = options.username
        ? ["AUTH", options.username, options.password]
        : ["AUTH", options.password];
      await connection.sendCommand(authArgs);
    }

    await connection.sendCommand(["PING"]);
    return connection;
  }

  async sendCommand(args: string[]): Promise<unknown> {
    const payload = serializeCommand(args);

    return new Promise((resolve, reject) => {
      this.pending.push({ resolve, reject });
      this.socket.write(payload);
    });
  }

  disconnect(): void {
    this.socket.destroy();
    this.pending.splice(0, this.pending.length);
    this.buffer = "";
  }

  private onData(data: Buffer): void {
    this.buffer += data.toString("utf8");

    while (true) {
      const parsed = parseResponse(this.buffer);
      if (!parsed) {
        break;
      }

      this.buffer = this.buffer.slice(parsed.nextIndex);
      const pending = this.pending.shift();
      if (!pending) {
        continue;
      }

      if (parsed.error) {
        pending.reject(parsed.error);
        continue;
      }

      pending.resolve(parsed.value);
    }
  }
}

function serializeCommand(parts: string[]): string {
  const serialized = parts
    .map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`)
    .join("");
  return `*${parts.length}\r\n${serialized}`;
}

interface ParsedResponse {
  value?: unknown;
  error?: Error;
  nextIndex: number;
}

function parseResponse(buffer: string): ParsedResponse | null {
  if (!buffer.length) {
    return null;
  }

  const type = buffer[0];
  switch (type) {
    case "+":
      return parseSimpleString(buffer);
    case "-": {
      const simple = parseSimpleString(buffer);
      if (!simple) return null;
      return { error: new Error(simple.value as string), nextIndex: simple.nextIndex };
    }
    case ":":
      return parseInteger(buffer);
    case "$":
      return parseBulkString(buffer);
    case "*":
      return parseArray(buffer);
    default:
      return { error: new Error(`Unknown RESP type: ${type}`), nextIndex: buffer.length };
  }
}

function parseSimpleString(buffer: string): ParsedResponse | null {
  const end = buffer.indexOf("\r\n");
  if (end === -1) return null;
  return { value: buffer.slice(1, end), nextIndex: end + 2 };
}

function parseInteger(buffer: string): ParsedResponse | null {
  const end = buffer.indexOf("\r\n");
  if (end === -1) return null;
  const num = Number.parseInt(buffer.slice(1, end), 10);
  return { value: num, nextIndex: end + 2 };
}

function parseBulkString(buffer: string): ParsedResponse | null {
  const endOfLength = buffer.indexOf("\r\n");
  if (endOfLength === -1) return null;

  const length = Number.parseInt(buffer.slice(1, endOfLength), 10);
  const start = endOfLength + 2;

  if (length === -1) {
    return { value: null, nextIndex: start };
  }

  const end = start + length;
  if (buffer.length < end + 2) return null;

  const value = buffer.slice(start, end);
  return { value, nextIndex: end + 2 };
}

function parseArray(buffer: string): ParsedResponse | null {
  const endOfLength = buffer.indexOf("\r\n");
  if (endOfLength === -1) return null;

  const length = Number.parseInt(buffer.slice(1, endOfLength), 10);
  if (length === -1) {
    return { value: null, nextIndex: endOfLength + 2 };
  }

  const values: unknown[] = [];
  let cursor = endOfLength + 2;

  for (let i = 0; i < length; i += 1) {
    const next = parseResponse(buffer.slice(cursor));
    if (!next) return null;
    if (next.error) return next;
    values.push(next.value);
    cursor += next.nextIndex;
  }

  return { value: values, nextIndex: cursor };
}

let redisPromise: Promise<RedisConnection | null> | null = null;

function parsePort(portText: string | undefined): number {
  if (!portText) {
    return 6379;
  }

  const parsed = Number.parseInt(portText, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid REDIS_PORT: ${portText}`);
  }

  return parsed;
}

export async function initRedisClient(): Promise<RedisConnection | null> {
  if (redisPromise) {
    return redisPromise;
  }

  const host = process.env.REDIS_HOST;
  if (!host) {
    console.warn("Redis not configured. Set REDIS_HOST to enable Redis connections.");
    redisPromise = Promise.resolve(null);
    return redisPromise;
  }

  const options: RedisConnectionOptions = {
    host,
    port: parsePort(process.env.REDIS_PORT),
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    useTls: process.env.REDIS_TLS === "true"
  };

  redisPromise = RedisConnection.connect(options)
    .then((client) => {
      console.log(
        `Connected to Redis at ${options.host}:${options.port}${options.useTls ? " (TLS)" : ""}`
      );
      return client;
    })
    .catch((err) => {
      console.error("Failed to initialize Redis", err);
      return null;
    });

  return redisPromise;
}
