#!/usr/bin/env node
'use strict';

const fs = require('fs');

const args = process.argv;

const classOffset = 34; // 00 Amazon, 01 Sorceress, 02 Necromancer, 03 Paladin, 04 Barbarian
const unspentOffset = 562; // must be set to 255 for unspent stat and skill points to show up
const statOffset = 581; // number of unspent stat points
const skillOffset = 585; // number of unspent skill points

const classSkills = {
  amazon: [623, 652],
  sorceress: [619, 648],
  necromancer: [619, 648],
  paladin: [623, 652],
  barbarian: [619, 648],
};

function getValue(buffer, offset) {
  return buffer[offset].toString(16).toUpperCase();
}

function resetPoints(args, buffer) {
  let charClass;
  let unspentStats = 0;
  let unspentSkills = 0;
  switch (getValue(buffer, classOffset)) {
    case '0':
      charClass = 'amazon';
      break;
    case '1':
      charClass = 'sorceress';
      break;
    case '2':
      charClass = 'necromancer';
      break;
    case '3':
      charClass = 'paladin';
      break;
    case '4':
      charClass = 'barbarian';
      break;
  }
  switch (getValue(buffer, unspentOffset)) {
    case 'DF':
      unspentStats = parseInt(getValue(buffer, statOffset), 16);
      break;
    case 'EF':
      unspentSkills = parseInt(getValue(buffer, skillOffset - 4), 16);
      break;
    case 'FF':
      unspentStats = parseInt(getValue(buffer, statOffset), 16);
      unspentSkills = parseInt(getValue(buffer, skillOffset), 16);
      break;
  }
  if (!unspentStats) {
    let startBuffer = buffer.slice(0, statOffset);
    let endBuffer = buffer.slice(statOffset);
    buffer = Buffer.concat([startBuffer, Buffer.alloc(4), endBuffer]);
  }
  if (!unspentSkills) {
    let startBuffer = buffer.slice(0, skillOffset);
    let endBuffer = buffer.slice(skillOffset);
    buffer = Buffer.concat([startBuffer, Buffer.alloc(4), endBuffer]);
  }
  let unassignedSkills = 0;
  let startSkills = classSkills[charClass][0];
  let endSkills = classSkills[charClass][1];
  for (let i = startSkills; i <= endSkills; i++) {
    unassignedSkills += parseInt(getValue(buffer, i), 16);
    buffer[i] = parseInt('0', 16);
  }
  buffer[skillOffset] = unspentSkills + unassignedSkills;
  buffer[unspentOffset] = parseInt('FF', 16); // set to 255 to enable unspent stat and skill points
  // buffer[statOffset] = parseInt('0', 16); // set unspent stat points to 0
  // buffer[skillOffset] = parseInt('0', 16); // set unspent skill points to 0
  // buffer[613] = parseInt(63, 16); // set level to 99
  // buffer[43] = parseInt(63, 16); // set level to 99
  fs.writeFile(args[2], buffer, function (error) {
    if (error) {
      console.log(error);
    } else {
      console.log('Skill points have been unassigned.');
    }
  });
}

fs.readFile(args[2], function read(error, buffer) {
  if (error) {
    return console.log(error);
  } else {
    resetPoints(args, buffer);
  }
});
