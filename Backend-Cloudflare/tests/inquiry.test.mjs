import assert from 'node:assert/strict';
import test from 'node:test';
import { inquiryLink, DEFAULT_INQUIRY_BODY } from '../lib/inquiry.ts';

const product={id:1,name:'專車手機支架 $&',category:'手機底座',series:'螢幕款',brand:'AUDI',model:'Q5',year:'18-20',sku:'BAY-AU001',barcode:'4715309075319',description:'不應寄出的商品說明',accent:'#f97316'};
test('inquiry preserves customer fields and inserts the current product without its description',()=>{
  const link=new URL(inquiryLink({email:'sales@example.com',subject:'我想購買',body:DEFAULT_INQUIRY_BODY},product));
  const body=link.searchParams.get('body');
  for(const label of ['姓名：','電話：','地址：','購買品項：專車手機支架 $&','車款：Q5','年份：18-20','汽車廠牌：AUDI','廠商報價 SKU：BAY-AU001','國際條碼 EAN：4715309075319']) assert.ok(body.includes(label),label);
  assert.ok(body.endsWith('我們將有專人與您確認訂單，謝謝'));
  assert.ok(!body.includes(product.description));
});
test('custom inquiry templates include wiper specifications and preserve entered customer information',()=>{
  const wiper={...product,category:'雨刷',wiperSpec:{position:'後擋雨刷',size:'350 mm',connector:'16 mm',quantity:'1 支'}};
  const body=new URL(inquiryLink({email:'sales@example.com',subject:'詢問',body:'姓名：王先生\n電話：0900000000\n購買品項：\n\n車款：\n年份：'},wiper)).searchParams.get('body');
  assert.ok(body.includes('姓名：王先生\n電話：0900000000'));
  assert.ok(body.includes('接頭規格：16 mm'));
  assert.ok(body.includes('雨刷尺寸：350 mm'));
});
