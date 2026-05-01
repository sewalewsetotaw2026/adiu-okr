export default class APIError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code || "ERROR";
    this.name = "APIError";
  }
}
