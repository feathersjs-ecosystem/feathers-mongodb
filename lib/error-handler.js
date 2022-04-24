"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const errors_1 = __importDefault(require("@feathersjs/errors"));
function errorHandler(error) {
    // See https://github.com/mongodb/mongo/blob/master/docs/errors.md
    if (error.name === 'MongoError') {
        throw new errors_1.default.GeneralError(error, {
            name: error.name,
            code: error.code
        });
    }
    throw error;
}
exports.errorHandler = errorHandler;
;
//# sourceMappingURL=error-handler.js.map