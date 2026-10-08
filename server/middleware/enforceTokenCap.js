import { assertWithinTokenCap } from "../utils/tokenCap.js";
import { assertWithinCallCap } from "../utils/aiCallCap.js";
import { sendServerError } from "../utils/httpError.js";


/**
 * Resolve internal abuse/cost limits before the controller. The controller
 * enforces them only after its zero-cost cache lookup, so cached results remain
 * available without exposing allowance counters to the client.
 */
export async function enforceTokenCap(req, res, next) {
  try {
    const [tokenResult, callResult] = await Promise.all([
      assertWithinTokenCap(req.userId),
      assertWithinCallCap(req.userId),
    ]);
    req.tokenCapStatus = tokenResult;
    req.callCapStatus = callResult;
    next();
  } catch (err) {
    return sendServerError(res, err, "[enforceTokenCap]");
  }
}
