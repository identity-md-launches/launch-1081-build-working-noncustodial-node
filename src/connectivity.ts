// Public HTTP GETs only; no accounts, signatures or invented relayer routes.
import {createHash} from 'node:crypto';
export async function connectivity() {
  const results=[];
  for(const url of ['https://papertrade.xyz/','https://docs.papertrade.xyz/','https://exchange.papertrade.xyz/']) {
    try {
      const r=await fetch(url,{signal:AbortSignal.timeout(10000)}), body=await r.text();
      results.push({url,status:r.status,bytes:Buffer.byteLength(body),sha256:createHash('sha256').update(body).digest('hex')});
      if(url.includes('docs.')&&r.ok) {
        const asset=body.match(/src="([^" ]+\.js)"/);
        if(asset) {
          const assetUrl=new URL(asset[1],url).href;
          const a=await fetch(assetUrl,{signal:AbortSignal.timeout(10000)}), js=await a.text();
          results.push({url:assetUrl,status:a.status,bytes:Buffer.byteLength(js),sha256:createHash('sha256').update(js).digest('hex')});
        }
      }
    } catch {results.push({url,error:'Read-only request failed'});}
  }
  return {checkedAt:new Date().toISOString(),liveSupported:false,results};
}
