const esbuild=require('esbuild'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'lc100-physics-'));
try{for(const name of ['test-physics','test-terrain','test-traction']){const out=path.join(temp,name+'.mjs');esbuild.buildSync({entryPoints:[name+'.mjs'],bundle:true,platform:'node',format:'esm',outfile:out});const result=spawnSync(process.execPath,[out],{stdio:'inherit'});if(result.status!==0)process.exitCode=1}}finally{fs.rmSync(temp,{recursive:true,force:true})}
