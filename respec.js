#!/usr/bin/env node
'use strict';

const fs = require('fs');

const args = process.argv;

const bufferSize = 2; // number of bytes to use for values, can handle numbers up to 65535

const classOffset = 34; // 00 amazon, 01 sorceress, 02 necromancer, 03 paladin, 04 barbarian, 05 druid, 06 assassin

const levelOffset = 36; // character level

const unspentOffset = 562; // set to 255 to enable unspent skill points and attributes

const newStatsOffset = 581; // number of unspent attribute points
const newSkillOffset = 585; // number of unspent skill points

const maxStatsOffsets = [610, 594, 602]; // stamina, life, mana
const currentStatsOffsets = [606, 590, 598]; // stamina, life, mana

const attributeOffsets = [565, 573, 577, 569]; // strength, dexterity, vitality, energy

const halfPointOffsets = [597, 601]; // used to calculate mana gain from next energy point

const startingAttributes = {
  // strength, dexterity, vitality, energy
  amazon: [20, 25, 20, 15],
  sorceress: [10, 25, 10, 35],
  necromancer: [15, 25, 15, 25],
  paladin: [25, 20, 25, 15],
  barbarian: [30, 20, 25, 10],
  druid: [15, 20, 25, 20],
  assassin: [20, 20, 20, 25],
};

const statsChanges = {
  // stamina, life, mana
  amazon: [1, 3, 1.5],
  sorceress: [1, 2, 2],
  necromancer: [1, 2, 2],
  paladin: [1, 3, 1.5],
  barbarian: [1, 4, 1],
  druid: [1, 2, 2],
  assassin: [1.25, 3, 1.75],
};

const classNumber = [
  'amazon',
  'sorceress',
  'necromancer',
  'paladin',
  'barbarian',
  'druid',
  'assassin',
];

const maxStats = [0, 0, 0];

let level; // character level
let charClass; // character class
let unspentSkills; // unspent skills
let unspentAttributes; // unspent attributes
let firstSkillOffset; // address of first class skill
let lastSkillOffset; // address of last class skill

const getValue = (offset, size, buffer) => {
  let value = '';
  for (let i = offset + size - 1; i >= offset; i--) {
    value += buffer[i].toString(16).toUpperCase();
  }
  return parseInt(value, 16);
};

const setValue = (value, offset, size, buffer) => {
  const hexCodes = [];
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
  // console.log({ hexCodes });
  return buffer;
};

const getStats = (buffer) => {
  level = buffer[levelOffset];
  for (let i = 0; i < maxStats.length; i++) {
    maxStats[i] = getValue(maxStatsOffsets[i], bufferSize, buffer);
  }
  return buffer;
};

const setStats = (unassigned, buffer) => {
  let halfPoint = 0;
  const stamina = maxStats[0] - statsChanges[charClass][0] * unassigned[2];
  const life = maxStats[1] - statsChanges[charClass][1] * unassigned[2];
  let mana;
  if ((charClass == 'amazon' || charClass == 'paladin') && level % 2 == 0) {
    mana = maxStats[2] - Math.ceil(statsChanges[charClass][2] * unassigned[3]);
    halfPoint = 128;
  } else {
    mana = maxStats[2] - Math.floor(statsChanges[charClass][2] * unassigned[3]);
  }
  const stats = [stamina, life, mana];
  for (let i = 0; i < stats.length; i++) {
    buffer = setValue(stats[i], maxStatsOffsets[i], bufferSize, buffer);
    buffer = setValue(stats[i], currentStatsOffsets[i], bufferSize, buffer);
  }
  for (let i = 0; i < halfPointOffsets.length; i++) {
    buffer[halfPointOffsets[i]] = halfPoint;
  }
  return buffer;
};

const getSkills = (buffer) => {
  firstSkillOffset = buffer.indexOf('6966', 0, 'hex') + 2;
  lastSkillOffset = buffer.indexOf('4A4D', 0, 'hex') - 1;
  return buffer;
};

const getClass = (buffer) => {
  charClass = classNumber[buffer[classOffset]];
  // console.log(charClass);
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
  // console.log(buffer.length);
  if (buffer[unspentOffset] !== 223 && buffer[unspentOffset] !== 255) {
    const startBuffer = buffer.slice(0, newStatsOffset);
    const endBuffer = buffer.slice(newStatsOffset);
    buffer = Buffer.concat([startBuffer, Buffer.alloc(4), endBuffer]);
  }
  if (buffer[unspentOffset] !== 239 && buffer[unspentOffset] !== 255) {
    const startBuffer = buffer.slice(0, newSkillOffset);
    const endBuffer = buffer.slice(newSkillOffset);
    buffer = Buffer.concat([startBuffer, Buffer.alloc(4), endBuffer]);
  }
  buffer[unspentOffset] = 255;
  // console.log(buffer.length);
  return buffer;
};

const resetSkills = (buffer) => {
  let unassigned = 0;
  if (lastSkillOffset - firstSkillOffset === 29) {
    for (let i = firstSkillOffset; i <= lastSkillOffset; i++) {
      unassigned += buffer[i];
      buffer[i] = 0;
    }
    buffer[newSkillOffset] = unspentSkills + unassigned;
  }
  return buffer;
};

const resetAttributes = (buffer) => {
  const unassigned = [0, 0, 0, 0];
  const attributes = ['', '', '', ''];
  for (let i = 0; i < attributeOffsets.length; i++) {
    for (let j = attributeOffsets[i] + 3; j >= attributeOffsets[i]; j--) {
      attributes[i] += buffer[j].toString(16).toUpperCase().padStart(2, '0');
    }
    attributes[i] = parseInt(attributes[i], 16);
    unassigned[i] = attributes[i] - startingAttributes[charClass][i];
    buffer.fill(0, attributeOffsets[i], attributeOffsets[i] + 4);
    buffer[attributeOffsets[i]] = startingAttributes[charClass][i];
  }
  const totalUnassigned =
    (unspentAttributes || 0) + unassigned.reduce((a, b) => a + b);
  buffer = setValue(totalUnassigned, newStatsOffset, bufferSize, buffer);
  buffer = setStats(unassigned, buffer);
  // console.log({ unassigned });
  // console.log({ attributes });
  return buffer;
};

fs.readFile(args[2], (error, buffer) => {
  if (buffer[4] == 71 || buffer[4] == 87 || buffer[4] == 89) {
    if (error) {
      return console.log(error);
    } else {
      buffer = addToBuffer(buffer);
      buffer = getUnspent(buffer);
      buffer = getClass(buffer);
      buffer = getStats(buffer);
      buffer = getSkills(buffer);
      buffer = resetSkills(buffer);
      buffer = resetAttributes(buffer);
      fs.writeFile(args[2], buffer, (error) => {
        if (error) {
          console.log(error);
        } else {
          // console.log({ maxStats });
          console.log('Skill points and attributes have been unassigned.');
        }
      });
    }
  } else {
    console.log(
      'Error: Wrong version number. Only works for patch 1.00 - 1.08.'
    );
  }
});
