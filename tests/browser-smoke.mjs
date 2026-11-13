import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { mkdir } from "node:fs/promises";
import { chromium, devices } from "playwright";

const PORT=8765;
const url="http://127.0.0.1:"+PORT;
const server=spawn("python3",["-m","http.server",String(PORT),"--bind","127.0.0.1"],{stdio:"ignore"});
let browser;
const allErrors=[];
try{
  for(let tries=0;tries<50;tries++){
    try{const response=await fetch(url);if(response.ok)break;}catch{}
    if(tries===49)throw new Error("Test server did not start.");
    await delay(160);
  }
  browser=await chromium.launch({headless:true,args:[
    "--use-gl=angle","--use-angle=swiftshader","--enable-webgl",
    "--enable-unsafe-swiftshader","--disable-dev-shm-usage"
  ]});
  await mkdir("artifacts",{recursive:true});
  async function openApp(context){
    const page=await context.newPage();
    page.on("pageerror",error=>allErrors.push(error.message));
    page.on("console",msg=>{
      if(msg.type()==="error")allErrors.push("CONSOLE: "+msg.text());
    });
    page.on("dialog",dialog=>dialog.accept());
    await page.goto(url,{waitUntil:"domcontentloaded"});
    try{
      await page.waitForFunction(()=>!document.querySelector("#loading-message"),null,{timeout:45000});
    }catch(e){
      console.log("HANGAR LOAD STATE",await page.locator("#loading-message").textContent().catch(()=>null));
      console.log("ERRORS",allErrors);
      throw e;
    }
    await page.locator('[data-nav="factory"]').click();
    await page.waitForFunction(()=>document.querySelector("#factory-3d-status")?.textContent?.includes("9 / 9"),null,{timeout:12000});
    return page;
  }
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  const page=await openApp(context);
  assert.equal(await page.locator(".factory-placed").count(),9);
  assert.equal(await page.locator(".factory-3d-status").textContent(),"3D: 9 / 9");
  await page.locator('[data-tool="conveyor"]').click();
  await page.locator('[data-cell][data-x="2"][data-y="6"]').hover();
  assert.equal(await page.locator("#factory-ghost").isVisible(),true);
  await page.screenshot({path:"artifacts/factory-before.png",fullPage:true});
  await page.locator('[data-factory-preview]').click();
  assert.equal(await page.locator(".main-stage").evaluate(node=>node.classList.contains("factory-preview-mode")),true);
  await page.waitForTimeout(1400);
  await page.screenshot({path:"artifacts/factory-3d-inspection.png",fullPage:true});
  await page.locator("#factory-return").click();
  assert.equal(await page.locator(".main-stage").evaluate(node=>node.classList.contains("factory-preview-mode")),false);
  await page.locator('[data-factory-action="reset"]').click();
  await page.waitForFunction(()=>document.querySelector("#factory-3d-status")?.textContent==="3D: 0 / 0");
  assert.equal(await page.locator(".factory-placed").count(),0);
  assert.equal(await page.locator('[data-tool="conveyor"] .machine-stock-badge').textContent(),"10");
  const initialScrap=await page.locator("#hud-scrap").textContent();
  await page.locator('[data-factory-action="demo"]').first().click();
  await page.waitForFunction(()=>document.querySelector("#factory-3d-status")?.textContent==="3D: 9 / 9");
  assert.equal(await page.locator("#hud-scrap").textContent(),initialScrap);
  await page.screenshot({path:"artifacts/factory-restored.png",fullPage:true});
  const mobile=await browser.newContext({...devices["Pixel 7"]});
  const phone=await openApp(mobile);
  await delay(1500);
  await phone.locator('[data-factory-action="reset"]').click();
  await phone.waitForFunction(()=>document.querySelector("#factory-3d-status")?.textContent==="3D: 0 / 0");
  assert.equal(await phone.locator(".factory-placed").count(),0);
  await phone.screenshot({path:"artifacts/factory-phone-cleared.png",fullPage:true});
  if(allErrors.length)throw new Error("Browser errors: "+allErrors.join("\n"));
  console.log("PASS: Three.js scene loaded with 9 factory models.");
  console.log("PASS: Hover ghost, clear layout, stock return, restore layout and mobile clear.");
}finally{
  await browser?.close();
  server.kill("SIGTERM");
}
