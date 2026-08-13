// @ts-nocheck
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {computePaipan} from './api';

const PORT=Number(process.env.PORT||8787),HOST=process.env.HOST||'0.0.0.0',PUBLIC_DIR=path.resolve(process.cwd(),'public');
const TYPES:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
function json(res:http.ServerResponse,status:number,body:any){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));}
async function body(req:http.IncomingMessage){let text='';for await(const chunk of req){text+=chunk;if(text.length>1_000_000)throw new Error('请求数据过大');}return text?JSON.parse(text):null;}
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
    if(url.pathname==='/api/paipan'||url.pathname==='/api.php'){
      if(req.method!=='POST')return json(res,405,{ok:false,message:'仅支持 POST 请求'});
      let input:any;try{input=await body(req);}catch{return json(res,400,{ok:false,message:'请求数据格式无效'});}
      const out=computePaipan(input);return json(res,out.ok?200:422,out);
    }
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end('Method Not Allowed');}
    let rel=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));rel=path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, '');
    const file=path.resolve(PUBLIC_DIR,rel);if(!file.startsWith(PUBLIC_DIR+path.sep)&&file!==PUBLIC_DIR){res.writeHead(403);return res.end('Forbidden');}
    try{const data=await readFile(file);res.writeHead(200,{'Content-Type':TYPES[path.extname(file).toLowerCase()]||'application/octet-stream'});if(req.method==='HEAD')return res.end();res.end(data);}catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Not Found');}
  }catch(e:any){json(res,500,{ok:false,message:e?.message??'服务器错误'});}
});
server.listen(PORT,HOST,()=>console.log(`Bazi TypeScript server: http://${HOST}:${PORT}`));
