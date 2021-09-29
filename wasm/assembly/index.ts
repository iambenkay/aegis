import * as aegis from "./aegis";
import * as nn from "./neural-net";
import * as tst from "./test";

const key: i32 = 0;
const val: i32 = 1;

export class ModelSpec {
  modelName: string;
  endpoint: string;
  constructor(name: string, endpoint: string) {
    this.modelName = name;
    this.endpoint = endpoint;
  }
}

export function getModelSpec(): ModelSpec {
  return new ModelSpec("wasm", "wasm");
}

export const ArrayOfStrings_ID = idof<string[]>();

function findVal(key: string, keys: string[], vals: string[]): string {
  let val: string = "unknown";
  for (let i: i32 = 0; i < keys.length; i++) {
    if (keys[i] == key) {
      val = vals[i];
      break;
    }
  }
  return val;
}

export function modelFactory(keys: string[], values: string[]): string[][] {
  const arr = new Array<string[]>(3);
  arr[0] = ["key1", findVal("key1", keys, values)];
  arr[1] = ["key2", findVal("key2", keys, values)];
  arr[2] = ["fibonacci", findVal("key3", keys, values)];
  return arr;
}

export function test(keys: string[], values: string[]): string[][] {
  const key1 = keys[0] == "key1" ? values[0] : "default";
  const key2 = keys[1] == "key2" ? values[1] : "default";
  const arr = new Array<string[]>(3);
  arr[0] = ["key1", key1];
  arr[1] = ["key2", key2];
  arr[2] = ["key3", "alwaysThisValue"];
  aegis.log("test called");
  return arr;
}

export function getCommands(): string[][] {
  const commands = new Array<string[]>(7);
  commands[0] = ["websocketListen", "tell wasm module to begin listening"];
  commands[1] = ["websocketNotify", "tell wasm module to send broadcast"];
  commands[2] = ["runFibonacci", "remote calculate fibonacci for a number"];
  commands[3] = ["websocketCallback", "subscribed event fired"];
  commands[4] = ["fibonacci", "calculate fibonacci for a number"];
  commands[5] = ["deployModule", "request deployment of a module"];
  commands[6] = ["commandEx", "command example"];
  return commands;
}

export function websocketListen(keys: string[], values: string[]): void {
  aegis.log("websocketListen" + keys[0] + ":" + values[0]);
  aegis.addListener("wasmWebListen", "websocketCallback");
}

export function websocketNotify(eventName: string, eventData: string): void {
  aegis.log("wasm invoked websocket notify " + eventName + " " + eventData);
  aegis.fireEvent("wasmWebListen", "test");
}

export function websocketCallback(
  keys: string[],
  values: string[]
): string[][] {
  aegis.log("websocket callbacked fired" + keys[0] + " " + values[0]);
  return [["key1", "websocketCallback"]];
}

export function inboundPort(keys: string[], vals: string[]): string[][] {
  aegis.log("inbound port called" + keys[0] + " " + vals[0]);
  const outval = new Array<string[]>(1);
  outval[0] = ["key1", "val1"];
  aegis.invokePort("task1", "task data", "task1Event", "", "");
  return outval;
}

export function fibonacci(x: number): number {
  if (x === 0) {
    return 0;
  }

  if (x === 1) {
    return 1;
  }

  return fibonacci(x - 1) + fibonacci(x - 2);
}

export function runFibonacci(keys: string[], vals: string[]): string[][] {
  let val: number = 0;
  let startTime: i64 = Date.now();

  for (let i = 0; i < keys.length; i++) {
    if ("fibonacci" == keys[i]) {
      val = parseFloat(vals[i]);
      break;
    }
  }
  const sum = fibonacci(val);
  const ret = new Array<string[]>(2);
  ret[0] = ["result", sum.toString()];
  ret[1] = ["time", (Date.now() - startTime).toString()];
  return ret;
}

export function getPorts(keys: string[], vals: string[]): string[][] {
  aegis.log("getPorts called  " + keys[0] + ":" + vals[0]);
  const ports = new Array<string[]>(2);
  ports[0] = ["notify", "Event,0,outbound"];
  ports[1] = ["listen", "Event,0,outbound"];
  return ports;
}

export function commandEx(keys: string[], vals: string[]): string[][] {
  aegis.log("\ncommandEx called " + keys[0] + ":" + vals[0]);
  const retval = new Array<string[]>(1);
  retval[0] = ["key1", "commandEx_update!"];
  return retval;
}

export function portEx(keys: string[], vals: string[]): void {
  aegis.log("portEx calling port wasmTestPort" + keys[0] + ":" + vals[0]);
  return;
}

export function onUpdate(keys: string[], vals: string[]): string[][] {
  return [["updatedByWasm", new Date(Date.now()).toUTCString()]];
}

export function onDelete(keys: string[], vals: string[]): i8 {
  // return negative to stop the action
  aegis.log("onDelete called " + keys[0] + ":" + vals[0]);
  return -1;
}

export function validate(keys: string[], vals: string[]): void {
  aegis.log("onUpdate called " + keys[0] + ":" + vals[0]);
  return;
}
