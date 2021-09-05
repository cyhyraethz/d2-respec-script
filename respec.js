#!/usr/bin/env node
'use strict';

const fs = require('fs');

const args = process.argv;

const bufferSize = 2; // number of bytes to use for values, can handle numbers up to 65535

const classOffset = 34; // 00 amazon, 01 sorceress, 02 necromancer, 03 paladin, 04 barbarian

const unspentOffset = 562; // set to 255 to enable unspent skill points and attributes

const newStatsOffset = 581; // number of unspent attribute points
const newSkillOffset = 585; // number of unspent skill points

const firstSkillOffset = 619; // address of first class skill
const lastSkillOffset = 648; // address of last class skill

const maxStatsOffsets = [610, 594, 602]; // stamina, life, mana
const currentStatsOffsets = [606, 590, 598]; // stamina, life, mana

const attributeOffsets = [565, 573, 577, 569]; // strength, dexterity, vitality, energy

const startingAttributes = {
  // strength, dexterity, vitality, energy
  amazon: [20, 25, 20, 15],
  sorceress: [10, 25, 10, 35],
  necromancer: [15, 25, 15, 25],
  paladin: [25, 20, 25, 15],
  barbarian: [30, 20, 25, 10],
};

const statsChanges = {
  // stamina, life, mana
  amazon: [1, 3, 1.5], // first point +1 mana, second point +2 mana, Math.floor()
  sorceress: [1, 2, 2],
  necromancer: [1, 2, 2],
  paladin: [1, 3, 1.5], // first point +1 mana, second point +2 mana, Math.floor()
  barbarian: [1, 4, 1],
};

let maxStats = [0, 0, 0];

let charClass;
let unspentSkills;
let unspentAttributes;

const getValue = (offset, size, buffer) => {
  let value = '';
  for (let i = offset + size - 1; i >= offset; i--) {
    value += buffer[i].toString(16).toUpperCase();
  }
  return parseInt(value, 16);
};

const setValue = (value, offset, size, buffer) => {
  let hexCodes = [];
  value = value.toString(16).toUpperCase().split('');
  for (let i = value.length - 1; i >= 0; i -= 2) {
    if (value[i - 1]) {
      hexCodes.push(value[i - 1] + value[i]);
    } else {
      hexCodes.push('0' + value[i]);
    }
  }
  while (hexCodes.length < size) {
    hexCodes.push('00');
  }
  for (let i = 0; i < size; i++) {
    buffer[offset + i] = parseInt(hexCodes[i], 16);
  }
  console.log({ hexCodes });
  return buffer;
};

const getStats = (buffer) => {
  for (let i = 0; i < maxStats.length; i++) {
    maxStats[i] = getValue(maxStatsOffsets[i], bufferSize, buffer);
  }
  return buffer;
};

const getClass = (buffer) => {
  switch (buffer[classOffset]) {
    case 0:
      charClass = 'amazon';
      break;
    case 1:
      charClass = 'sorceress';
      break;
    case 2:
      charClass = 'necromancer';
      break;
    case 3:
      charClass = 'paladin';
      break;
    case 4:
      charClass = 'barbarian';
      break;
  }
  return buffer;
};

const getUnspent = (buffer) => {
  switch (buffer[unspentOffset]) {
    case 223:
      unspentAttributes = getValue(newStatsOffset, bufferSize, buffer);
      break;
    case 239:
      unspentSkills = getValue(newSkillOffset, bufferSize, buffer);
      break;
    case 255:
      unspentAttributes = getValue(newStatsOffset, bufferSize, buffer);
      unspentSkills = getValue(newSkillOffset, bufferSize, buffer);
      break;
  }
  return buffer;
};

const addToBuffer = (buffer) => {
  if (unspentAttributes === undefined) {
    const startBuffer = buffer.slice(0, newStatsOffset);
    const endBuffer = buffer.slice(newStatsOffset);
    buffer = Buffer.concat([startBuffer, Buffer.alloc(4), endBuffer]);
  }
  if (unspentSkills === undefined) {
    const startBuffer = buffer.slice(0, newSkillOffset);
    const endBuffer = buffer.slice(newSkillOffset);
    buffer = Buffer.concat([startBuffer, Buffer.alloc(4), endBuffer]);
  }
  buffer[unspentOffset] = 255;
  return buffer;
};

const resetSkills = (buffer) => {
  let unassigned = 0;
  for (let i = firstSkillOffset; i <= lastSkillOffset; i++) {
    unassigned += buffer[i];
    buffer[i] = 0;
  }
  buffer[newSkillOffset] = unspentSkills + unassigned;
  return buffer;
};

const resetAttributes = (buffer) => {
  let unassigned = [0, 0, 0, 0];
  let attributes = ['', '', '', ''];
  for (let i = 0; i < attributeOffsets.length; i++) {
    for (let j = attributeOffsets[i] + 3; j >= attributeOffsets[i]; j--) {
      attributes[i] += buffer[j].toString(16).toUpperCase().padStart(2, '0');
    }
    attributes[i] = parseInt(attributes[i], 16);
    unassigned[i] = attributes[i] - startingAttributes[charClass][i];
    buffer.fill(0, attributeOffsets[i], attributeOffsets[i] + 4);
    buffer[attributeOffsets[i]] = startingAttributes[charClass][i];
  }
  let totalUnassigned =
    (unspentAttributes || 0) + unassigned.reduce((a, b) => a + b);
  buffer = setValue(totalUnassigned, newStatsOffset, bufferSize, buffer);
  return buffer;
};

fs.readFile(args[2], (error, buffer) => {
  if (buffer[4] == 71) {
    if (error) {
      return console.log(error);
    } else {
      buffer = getStats(buffer);
      buffer = getClass(buffer);
      buffer = getUnspent(buffer);
      buffer = addToBuffer(buffer);
      buffer = resetSkills(buffer);
      buffer = resetAttributes(buffer);
      fs.writeFile(args[2], buffer, (error) => {
        if (error) {
          console.log(error);
        } else {
          console.log('Skill points and attributes have been unassigned.');
        }
      });
    }
  } else {
    console.log(
      'Error: Wrong version number. Only works for patch 1.00 - 1.06.'
    );
  }
});
