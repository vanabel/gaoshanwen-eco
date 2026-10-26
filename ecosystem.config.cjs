const path=require('node:path');
module.exports={apps:[{
 name:'economy-observatory',cwd:__dirname,script:'server/index.mjs',interpreter:process.execPath,
 instances:1,exec_mode:'fork',watch:false,autorestart:true,min_uptime:'10s',max_restarts:10,
 max_memory_restart:'256M',wait_ready:true,listen_timeout:15000,kill_timeout:60000,
 env:{NODE_ENV:'production',TZ:'Asia/Singapore'},
 out_file:path.join(__dirname,'logs/pm2-out.log'),error_file:path.join(__dirname,'logs/pm2-error.log'),
 merge_logs:true,log_date_format:'YYYY-MM-DD HH:mm:ss Z'
}]};
