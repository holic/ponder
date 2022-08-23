import { Bytes, Result } from './collections'
import { BigInt } from './numbers'
import { JSONValue } from './value'

/** Host JSON interface */
export declare namespace json {
  function fromBytes(data: Bytes): JSONValue
  function try_fromBytes(data: Bytes): Result<JSONValue, boolean>
  function toI64(decimal: string): bigint
  function toU64(decimal: string): bigint
  function toF64(decimal: string): f64
  function toBigInt(decimal: string): bigint
}

export namespace json {
  export function fromString(data: string): JSONValue {
    const bytes = Bytes.fromUTF8(data)

    return json.fromBytes(bytes)
  }

  export function try_fromString(data: string): Result<JSONValue, boolean> {
    const bytes = Bytes.fromUTF8(data)

    return json.try_fromBytes(bytes)
  }
}
