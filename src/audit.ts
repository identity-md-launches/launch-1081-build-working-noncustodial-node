import {mkdirSync, writeFileSync, renameSync, readFileSync, existsSync, openSync, writeSync, fsyncSync, closeSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
export class Audit {
  directory:string; head=''; sequence=0; output:boolean;
  constructor(directory:string,output=true) {
    this.directory=directory; this.output=output; mkdirSync(directory,{recursive:true,mode:0o700});
    const path=join(directory,'events.jsonl');
    if(existsSync(path)) for(const line of readFileSync(path,'utf8').trim().split('\n').filter(Boolean)) {
      const {hash,...row}=JSON.parse(line);
      if(row.previous!==this.head || row.sequence!==this.sequence+1 || hash!==createHash('sha256').update(JSON.stringify(row)).digest('hex')) throw Error('Audit integrity failure');
      this.head=hash; this.sequence=row.sequence;
    }
  }
  event(kind:string, data:unknown) {
    const row={sequence:++this.sequence,time:new Date().toISOString(),previous:this.head,kind,data};
    this.head=createHash('sha256').update(JSON.stringify(row)).digest('hex');
    const fd=openSync(join(this.directory,'events.jsonl'),'a',0o600);
    try{writeSync(fd,JSON.stringify({...row,hash:this.head})+'\n');fsyncSync(fd);}finally{closeSync(fd);}
    if(this.output) console.log(JSON.stringify({kind,data}));
  }
  save(state:unknown) {
    const temp=join(this.directory,'state.tmp'), target=join(this.directory,'state.json');
    writeFileSync(temp,JSON.stringify({auditHead:this.head,state},null,2),{mode:0o600});
    const fd=openSync(temp,'r');try{fsyncSync(fd);}finally{closeSync(fd);}renameSync(temp,target);
  }
  hasState(){return existsSync(join(this.directory,'state.json'));}
}
