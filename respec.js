#!/usr/bin/env node
'use strict';

const fs = require('fs');

const args = process.argv;

const classOffset = 34;

const unspentOffset = 562;

const newStatsOffset = 581;
const newSkillOffset = 585;

const firstSkillOffset = 619;
const lastSkillOffset = 648;

const attributeOffsets = [565, 573, 577, 569];

const startingAttributes = {
  amazon: [20, 25, 20, 15],
  sorceress: [10, 25, 10, 35],
  necromancer: [15, 25, 15, 25],
  paladin: [25, 20, 25, 15],
  barbarian: [30, 20, 25, 10],
};

const statChanges = {
  // stamina, life, mana
  amazon: [1, 3, 1.5], // even points +1 mana, odd points +2 mana
  sorceress: [1, 2, 2],
  necromancer: [1, 2, 2],
  paladin: [1, 3, 1.5], // even points +1 mana, odd points +2 mana
  barbarian: [1, 4, 1],
};

let charClass;
let unspentSkills;
let unspentAttributes;

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
      unspentAttributes = buffer[newStatsOffset];
      break;
    case 239:
      unspentSkills = buffer[newSkillOffset - 4];
      break;
    case 255:
      unspentAttributes = buffer[newStatsOffset];
      unspentSkills = buffer[newSkillOffset];
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
  buffer[newStatsOffset] =
    unspentAttributes + unassigned.reduce((a, b) => a + b);
  return buffer;
};

fs.readFile(args[2], (error, buffer) => {
  if (buffer[4] == 71) {
    if (error) {
      return console.log(error);
    } else {
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
