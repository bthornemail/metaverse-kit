import {
  runProgram,
  buildState256,
  zeroState256,
  hashRelation,
  buildSequentialState256Program,
} from "../src/index.js";

const program = `
PUSH "E1"
PUSH "E2"
PAIR
HASH
HALT
`;

const state = runProgram(program);
console.log("vm stack:", state.stack);

const atoms = zeroState256();
atoms[0] = "E1";
atoms[1] = "E2";
const { root, depth } = buildState256(atoms);
console.log(`state256 depth=${depth} root=${hashRelation(root)}`);

const state256Program = buildSequentialState256Program();
const vmState = runProgram(state256Program);
console.log("state256 vm root:", vmState.stack[0]);
