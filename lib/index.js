"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MongoDBService = void 0;
const adapter_1 = require("./adapter");
__exportStar(require("./adapter"), exports);
__exportStar(require("./error-handler"), exports);
class MongoDBService extends adapter_1.MongoDbAdapter {
    async find(params) {
        return await this._find(params);
    }
    async get(id, params) {
        return await this._get(id, params);
    }
    async create(data, params) {
        return await this._create(data, params);
    }
    async update(id, data, params) {
        return await this._update(id, data, params);
    }
    async patch(id, data, params) {
        return await this._patch(id, data, params);
    }
    async remove(id, params) {
        return await this._remove(id, params);
    }
}
exports.MongoDBService = MongoDBService;
//# sourceMappingURL=index.js.map