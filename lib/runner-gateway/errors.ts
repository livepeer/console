export class RunnerGatewayError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(
    message: string,
    options: { code?: string; status?: number } = {},
  ) {
    super(message);
    this.name = "RunnerGatewayError";
    this.code = options.code ?? "runner_error";
    this.status = options.status ?? 502;
  }
}

export class NoRunnerAvailableError extends RunnerGatewayError {
  constructor(message = "No runners available to select") {
    super(message, { code: "no_runners", status: 503 });
    this.name = "NoRunnerAvailableError";
  }
}

export class RunnerHttpError extends RunnerGatewayError {
  readonly statusCode: number;
  readonly body: string;

  constructor(statusCode: number, body: string, message?: string) {
    super(message ?? `HTTP ${statusCode} from runner`, {
      code: "runner_http_error",
      status: statusCode >= 500 ? 502 : statusCode,
    });
    this.name = "RunnerHttpError";
    this.statusCode = statusCode;
    this.body = body;
  }
}
