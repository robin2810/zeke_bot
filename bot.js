var Discord = require('discord.js');
var logger = require('winston');
var auth = require('./auth.json');
var fs = require('fs');
var scheduler = require('node-schedule');

var admin_roleid = '773310868443758592';
var trusted_roleid = '775937232980148286';

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
bot.login(auth.token);

var jobConnectBot = scheduler.scheduleJob('*/30 * * * * *', () => {
  if(!bot.connected) {
    bot.login(auth.token);
  }
});

bot.on('ready', evt => {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.user.username + ' - (' + bot.user.id + ')');
    logger.info('Current working dir: ' + __dirname);
});

bot.on('message', msg => {
  var message = msg.content;
  if (message.substring(0, 1) == '!') {
      var args = message.substring(1).split(' ');
      var cmd = args[0];
      var cmd2 = args[1];

      //args = args.splice(1);
      switch(cmd) {

          // !config <shortcut> <role>
          case 'config':
            if(msg.member.roles.cache.has(admin_roleid)) {
              var id_re = new RegExp("[0-9]{18}");
              if((msg.mentions.roles.first() == undefined && !id_re.exec(args[2]))) {
                msg.channel.send('Syntax: !config <shortcut> <@role> or !config <shortcut> <role id>');
              } else if(msg.mentions.roles.first() != undefined && cmd2 == msg.mentions.roles.first().toString()) {
                msg.channel.send('Syntax: !config <shortcut> <@role> or !config <shortcut> <role id>');
              } else {
                if(msg.mentions.roles.first() == undefined) {
                  var roleId = args[2];
                } else {
                  var roleId = msg.mentions.roles.first().id;
                }
                fs.readFile(__dirname + '/shortcuts.json', 'utf8', (err, data) => {
                  var commandsObj = JSON.parse(data);
                  if(Object.keys(commandsObj).includes(cmd2)) {
                    msg.channel.send('The command exists already, use !delete <shortcut> to delete it.');
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
              msg.channel.send('You are not permitted to use this command.');
            }
          break;

          // !delete <shortcut>
          case 'delete':
            if(msg.member.roles.cache.has(admin_roleid)) {
              fs.readFile(__dirname + '/shortcuts.json', 'utf8', (err, data) => {
                var commandsObj = JSON.parse(data);
                if(Object.keys(commandsObj).includes(cmd2)) {
                  delete commandsObj[cmd2];
                  fs.writeFile(__dirname + '/shortcuts.json', JSON.stringify(commandsObj, null, 2), 'utf8', (err) => {
                    if (err) throw err;
                    msg.channel.send('The command has been deleted.');
                  });
                } else {
                  msg.channel.send('This command does not exist. Syntax: !delete <shortcut>');
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
                msg.channel.send('Available commands:\n'.concat(Object.keys(commandsObj)));
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
                    if(msg.mentions.members.first().roles.cache.has(commandsObj[cmd].roleId)) {
                      msg.mentions.members.first().roles.remove(msg.guild.roles.cache.get(commandsObj[cmd].roleId));
                      msg.channel.send('Role \"'.concat(msg.guild.roles.cache.get(commandsObj[cmd].roleId).name, '\" removed from user ', msg.mentions.members.first().nickname));
                    } else {
                      if(msg.guild.roles.cache.get(commandsObj[cmd].roleId) == undefined) {
                        msg.channel.send('ID of shortcut \"'.concat(cmd, '\" is incorrect, consider deleting and readding!'));
                      } else {
                        msg.mentions.members.first().roles.add(msg.guild.roles.cache.get(commandsObj[cmd].roleId));
                        msg.channel.send('Role \"'.concat(msg.guild.roles.cache.get(commandsObj[cmd].roleId).name, '\" assigned to user ', msg.mentions.members.first().nickname));
                      }
                    }
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
