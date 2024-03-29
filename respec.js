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

const maxStatsOffsets = { stamina: 610, life: 594, mana: 602 };
const currentStatsOffsets = { stamina: 606, life: 590, mana: 598 };

const attributeOffsets = { strength: 565, dexterity: 573, vitality: 577, energy: 569 };

const fractionalOffsets = { stamina: [605, 609], life: [589, 593], mana: [597, 601] };

const questOffsets = { goldenBird: [181, 277, 373], lamEsenTome: [175, 271, 367] };

const skillQuests = {
  denOfEvil: { offsets: [143, 239, 335], skills: 1 },
  radamentLair: { offsets: [159, 255, 351], skills: 1 },
  fallenAngel: { offsets: [191, 287, 383], skills: 2 },
};

const startingAttributes = {
  amazon: { strength: 20, dexterity: 25, vitality: 20, energy: 15 },
  sorceress: { strength: 10, dexterity: 25, vitality: 10, energy: 35 },
  necromancer: { strength: 15, dexterity: 25, vitality: 15, energy: 25 },
  paladin: { strength: 25, dexterity: 20, vitality: 25, energy: 15 },
  barbarian: { strength: 30, dexterity: 20, vitality: 25, energy: 10 },
  druid: { strength: 15, dexterity: 20, vitality: 25, energy: 20 },
  assassin: { strength: 20, dexterity: 20, vitality: 20, energy: 25 },
};

const startingStats = {
  amazon: { stamina: 84, life: 50, mana: 15 },
  sorceress: { stamina: 74, life: 40, mana: 35 },
  necromancer: { stamina: 79, life: 45, mana: 25 },
  paladin: { stamina: 89, life: 55, mana: 15 },
  barbarian: { stamina: 91, life: 55, mana: 10 },
  druid: { stamina: 84, life: 55, mana: 20 },
  assassin: { stamina: 95, life: 50, mana: 25 },
};

const statsPerLevel = {
  amazon: { stamina: 1, life: 2, mana: 1.5 },
  sorceress: { stamina: 1, life: 1, mana: 2 },
  necromancer: { stamina: 1, life: 1.5, mana: 2 },
  paladin: { stamina: 1, life: 2, mana: 1.5 },
  barbarian: { stamina: 1, life: 2, mana: 1 },
  druid: { stamina: 1, life: 1.5, mana: 2 },
  assassin: { stamina: 1.25, life: 2, mana: 1.5 },
};

const classNumber = ['amazon', 'sorceress', 'necromancer', 'paladin', 'barbarian', 'druid', 'assassin'];

let level; // character level
let charClass; // character class

const setVariables = (buffer) => {
  level = buffer[levelOffset];
  charClass = classNumber[buffer[classOffset]];
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
  return buffer;
};

const setStats = (buffer) => {
  const fractionalStats = { stamina: 0, life: 0, mana: 0 };
  const calculatedStats = { stamina: 0, life: 0, mana: 0 };
  for (let offset of questOffsets['goldenBird']) if (buffer[offset] === 16) calculatedStats['life'] += 20;
  for (let stat in calculatedStats) {
    calculatedStats[stat] += startingStats[charClass][stat] + statsPerLevel[charClass][stat] * (level - 1);
    fractionalStats[stat] = (calculatedStats[stat] % 1) * 256;
    calculatedStats[stat] = Math.floor(calculatedStats[stat]);
    buffer = setValue(calculatedStats[stat], maxStatsOffsets[stat], bufferSize, buffer);
    buffer = setValue(calculatedStats[stat], currentStatsOffsets[stat], bufferSize, buffer);
    for (let offset of fractionalOffsets[stat]) buffer[offset] = fractionalStats[stat];
  }
  return buffer;
};

const addToBuffer = (buffer) => {
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
  setVariables(buffer);
  return buffer;
};

const resetSkills = (buffer) => {
  const firstSkillOffset = buffer.indexOf('6966', 0, 'hex') + 2;
  const lastSkillOffset = buffer.indexOf('4A4D', 0, 'hex') - 1;
  if (lastSkillOffset - firstSkillOffset === 29) {
    let unspentSkills = level - 1;
    for (let quest in skillQuests) {
      for (let offset of skillQuests[quest]['offsets']) {
        if (buffer[offset] === 16) {
          unspentSkills += skillQuests[quest]['skills'];
        }
      }
    }
    buffer.fill(0, firstSkillOffset, lastSkillOffset + 1);
    buffer[newSkillOffset] = unspentSkills;
  }
  return buffer;
};

const resetAttributes = (buffer) => {
  let unspentAttributes = 5 * (level - 1);
  for (let offset of questOffsets['lamEsenTome']) if (buffer[offset] === 16) unspentAttributes += 5;
  for (let offset in attributeOffsets) {
    buffer.fill(0, attributeOffsets[offset], attributeOffsets[offset] + 4);
    buffer[attributeOffsets[offset]] = startingAttributes[charClass][offset];
  }
  buffer = setValue(unspentAttributes, newStatsOffset, bufferSize, buffer);
  buffer = setStats(buffer);
  return buffer;
};

fs.readFile(args[2], (error, buffer) => {
  if (buffer[4] == 71 || buffer[4] == 87 || buffer[4] == 89) {
    if (error) {
      return console.log(error);
    } else {
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
    console.log('Error: Wrong version number. Only works for patch 1.00 - 1.08.');
  }
});
