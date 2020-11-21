var Discord = require('discord.js');
var logger = require('winston');
var auth = require('./auth.json');
var fs = require('fs');
var scheduler = require('node-schedule');

var admin_roleid = '773310868443758592';
var trusted_roleid = '775937232980148286';

const bot_prefix = 'pm!';

const monthNames = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const reservedCommands = ["ping", "config", "list", "delete"];

process.on('unhandledRejection', (reason, promise) => {
  console.log('Unhandled Rejection at:', reason.stack || reason)
});

// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';
// Initialize Discord Bot
var bot = new Discord.Client();

var today = new Date();
bot.login(auth.token);
logger.info('Bot logged in on '.concat(today.getUTCDate(), ' ', monthNames[today.getUTCMonth()], ' ', today.getUTCFullYear(), ' at ', getTime(today)));

var jobConnectBot = scheduler.scheduleJob('*/30 * * * * *', () => {
  if(bot.user == null) {
    var today = new Date();
    bot.login(auth.token);
    logger.info('Bot logged in on '.concat(today.getUTCDate(), ' ', monthNames[today.getUTCMonth()], ' ', today.getUTCFullYear(), ' at ', getTime(today)));
  }
});
logger.info('Connect job scheduled');

bot.on('ready', evt => {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.user.username + ' - (' + bot.user.id + ')');
    logger.info('Current working dir: ' + __dirname);
});

bot.on('message', msg => {
  var message = msg.content;
  if (message.substring(0, bot_prefix.length) == bot_prefix) {
      var args = message.substring(bot_prefix.length).split(' ');
      if(args[0] != undefined) {var cmd = args[0].toLowerCase();}
      if(args[1] != undefined) {var cmd2 = args[1].toLowerCase();}

      //args = args.splice(1);
      switch(cmd) {

          // pm!ping
          case 'ping':
            msg.channel.send('Pong!');
          break;

          // pm!config <shortcut> <role>
          case 'config':
            if(msg.member.roles.cache.has(admin_roleid) || msg.member.roles.cache.has(trusted_roleid)) {
              if(!reservedCommands.includes(cmd2)) {
                var id_re = new RegExp("[0-9]{18}");
                if((msg.mentions.roles.first() == undefined && !id_re.exec(args[2]))) {
                  msg.channel.send('Syntax: '.concat(bot_prefix, 'config <shortcut> <@role> or ', bot_prefix, 'config <shortcut> <role id>'));
                } else if(msg.mentions.roles.first() != undefined && cmd2 == msg.mentions.roles.first().toString()) {
                  msg.channel.send('Syntax: '.concat(bot_prefix, 'config <shortcut> <@role> or ', bot_prefix, 'config <shortcut> <role id>'));
                } else {
                  if(msg.mentions.roles.first() == undefined) {
                    var roleId = args[2];
                  } else {
                    var roleId = msg.mentions.roles.first().id;
                  }
                  fs.readFile(__dirname + '/shortcuts.json', 'utf8', (err, data) => {
                    var commandsObj = JSON.parse(data);
                    if(Object.keys(commandsObj).includes(cmd2)) {
                      msg.channel.send('The command exists already, use '.concat(bot_prefix, 'delete <shortcut> to delete it.'));
                    } else {
                      commandsObj[cmd2] = {roleId: roleId}
                      fs.writeFile(__dirname + '/shortcuts.json', JSON.stringify(commandsObj, null, 2), 'utf8', (err) => {
                        if (err) throw err;
                        msg.channel.send('The command has been created.');
                      });
                    }
                  });
                }
              } else {
                msg.channel.send('The command you are trying to assign is a reserved word.');
              }
            } else {
              msg.channel.send('You are not permitted to use this command.');
            }
          break;

          // pm!delete <shortcut>
          case 'delete':
            if(msg.member.roles.cache.has(admin_roleid) || msg.member.roles.cache.has(trusted_roleid)) {
              fs.readFile(__dirname + '/shortcuts.json', 'utf8', (err, data) => {
                var commandsObj = JSON.parse(data);
                if(Object.keys(commandsObj).includes(cmd2)) {
                  delete commandsObj[cmd2];
                  fs.writeFile(__dirname + '/shortcuts.json', JSON.stringify(commandsObj, null, 2), 'utf8', (err) => {
                    if (err) throw err;
                    msg.channel.send('The command has been deleted.');
                  });
                } else {
                  msg.channel.send('This command does not exist. Syntax: '.concat(bot_prefix, 'delete <shortcut>'));
                }
              });
            } else {
              msg.channel.send('You are not permitted to use this command.');
            }
          break;

          case 'list':
            if(msg.member.roles.cache.has(admin_roleid) || msg.member.roles.cache.has(trusted_roleid)) {
              fs.readFile(__dirname + '/shortcuts.json', 'utf8', (err, data) => {
                var commandsObj = JSON.parse(data);
                var list = '';
                for (var command in commandsObj) {
                  list = list.concat(bot_prefix, command, ' -> ',msg.guild.roles.cache.get(commandsObj[command].roleId).name , '\n');
                }
                msg.channel.send('Available commands:\n'.concat(list));
              });
            } else {
              msg.channel.send('You are not permitted to use this command.');
            }
          break;

          // any other command
          default:
            fs.readFile(__dirname + '/shortcuts.json', 'utf8', (err, data) => {
              var commandsObj = JSON.parse(data);
              if(Object.keys(commandsObj).includes(cmd)) {
                if(msg.member.roles.cache.has(admin_roleid) || msg.member.roles.cache.has(trusted_roleid)) {
                  if(msg.mentions.users.first() == undefined) {
                    msg.channel.send('You did not mention a user!');
                  } else {
                    var assigned = [];
                    var removed = [];
                    for (var member of msg.mentions.members) {
                      console.log(member[1]);
                      if(member[1].roles.cache.has(commandsObj[cmd].roleId)) {
                        member[1].roles.remove(msg.guild.roles.cache.get(commandsObj[cmd].roleId));
                        if(member[1].nickname == null) {
                          removed.push("".concat(member[1].user.username, '#', member[1].user.discriminator));
                        } else {
                          removed.push(member[1].nickname);
                        }
                      } else {
                        if(msg.guild.roles.cache.get(commandsObj[cmd].roleId) == undefined) {
                          msg.channel.send('ID of shortcut \"'.concat(cmd, '\" is incorrect, consider deleting and readding!'));
                        } else {
                          member[1].roles.add(msg.guild.roles.cache.get(commandsObj[cmd].roleId));
                          if(member[1].nickname == null) {
                            assigned.push("".concat(member[1].user.username, '#', member[1].user.discriminator));
                          } else {
                            assigned.push(member[1].nickname);
                          }
                        }
                      }
                    }
                    console.log(assigned);
                    console.log(removed);
                    msg.channel.send('Role \"'.concat(msg.guild.roles.cache.get(commandsObj[cmd].roleId).name, '\":\nassigned to user(s) ', assigned.join(', '), '\nremoved from user(s) ', removed.join(', ')));
                  }
                } else {
                  msg.channel.send('You are not permitted to use this command.');
                }
              } else {
                msg.channel.send('This command does not exist!');
              }
            });
          break;
       }
   }
});

function getTime(date) {
  if(date.getUTCHours() == 0) {
    return '12:' + (date.getUTCMinutes()).toString().padStart(2, '0') + 'am UTC';
  } else if(date.getUTCHours() < 12) {
    return date.getUTCHours() + ':' + (date.getUTCMinutes()).toString().padStart(2, '0') + 'am UTC';
  } else if(date.getUTCHours() == 12) {
    return '12:' + (date.getUTCMinutes()).toString().padStart(2, '0') + 'pm UTC';
  } else {
    return (date.getUTCHours()-12) + ':' + (date.getUTCMinutes()).toString().padStart(2, '0') + 'pm UTC';
  }
}
