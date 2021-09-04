#!/usr/bin/env node
'use strict';

const fs = require('fs');

const args = process.argv;

const unspentOffset = 562;
const newStatsOffset = 581;
const newSkillOffset = 585;
const firstSkillOffset = 619;
const lastSkillOffset = 648;

let unspentStats;
let unspentSkills;

const getValue = (buffer, offset) => {
  return buffer[offset].toString(16).toUpperCase();
};

const getUnspent = (buffer) => {
  switch (getValue(buffer, unspentOffset)) {
    case 'DF':
      unspentStats = parseInt(getValue(buffer, newStatsOffset), 16);
      break;
    case 'EF':
      unspentSkills = parseInt(getValue(buffer, newSkillOffset - 4), 16);
      break;
    case 'FF':
      unspentStats = parseInt(getValue(buffer, newStatsOffset), 16);
      unspentSkills = parseInt(getValue(buffer, newSkillOffset), 16);
      break;
  }
};

const addToBuffer = (buffer) => {
  if (!unspentStats) {
    const startBuffer = buffer.slice(0, newStatsOffset);
    const endBuffer = buffer.slice(newStatsOffset);
    buffer = Buffer.concat([startBuffer, Buffer.alloc(4), endBuffer]);
  }
  if (!unspentSkills) {
    const startBuffer = buffer.slice(0, newSkillOffset);
    const endBuffer = buffer.slice(newSkillOffset);
    buffer = Buffer.concat([startBuffer, Buffer.alloc(4), endBuffer]);
  }
  buffer[unspentOffset] = parseInt('FF', 16);
};

const resetSkills = (buffer) => {
  let unassignedSkills = 0;
  for (let i = firstSkillOffset; i <= lastSkillOffset; i++) {
    unassignedSkills += parseInt(getValue(buffer, i), 16);
    buffer[i] = parseInt('0', 16);
  }
  buffer[newSkillOffset] = unspentSkills + unassignedSkills;
};

const resetPoints = (args, buffer) => {
  getUnspent(buffer);
  addToBuffer(buffer);
  resetSkills(buffer);
  fs.writeFile(args[2], buffer, (error) => {
    if (error) {
      console.log(error);
    } else {
      console.log('Skill points have been unassigned.');
    }
  });
};

fs.readFile(args[2], (error, buffer) => {
  if (error) {
    return console.log(error);
  } else {
    resetPoints(args, buffer);
  }
});
