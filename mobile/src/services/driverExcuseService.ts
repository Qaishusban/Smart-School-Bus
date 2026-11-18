import { supabase } from '../lib/supabase';

export type DriverExcuseTripMode = 'to_school' | 'to_home';
export type ApprovedDriverExcuse = { id:string; student_id:string; request_type:string; status:string; date_from:string|null; date_to:string|null; trip_period:string|null; notes:string|null; created_at:string|null; };
function localDateKey(date:Date=new Date()){const y=date.getFullYear();const m=String(date.getMonth()+1).padStart(2,'0');const d=String(date.getDate()).padStart(2,'0');return `${y}-${m}-${d}`;}
function normalize(value:unknown){return String(value??'').trim().toLowerCase().replace(/\s+/g,'_');}
export async function getApprovedDriverExcuses(args:{studentIds:string[];tripMode:DriverExcuseTripMode;date?:string;}):Promise<ApprovedDriverExcuse[]>{
 const studentIds=Array.from(new Set(args.studentIds.map(String).filter(Boolean))); if(!studentIds.length)return [];
 const date=args.date??localDateKey();
 const {data,error}=await supabase.from('parent_requests').select('id,student_id,request_type,status,date_from,date_to,request_date,trip_period,notes,created_at').in('student_id',studentIds).in('request_type',['absence','no_bus']).eq('status','approved').lte('date_from',date).gte('date_to',date).order('created_at',{ascending:false});
 if(error){console.log('[driverExcuse] approved parent requests:',error);throw error;}
 const allowed=args.tripMode==='to_school'?new Set(['both','morning','to_school']):new Set(['both','afternoon','evening','to_home']); const seen=new Set<string>(); const result:ApprovedDriverExcuse[]=[];
 for(const row of data??[]){const studentId=String(row.student_id??'');if(!studentId||seen.has(studentId))continue;const period=normalize(row.trip_period||'both');if(!allowed.has(period))continue;seen.add(studentId);result.push({id:String(row.id),student_id:studentId,request_type:normalize(row.request_type),status:normalize(row.status),date_from:row.date_from??row.request_date??null,date_to:row.date_to??row.date_from??row.request_date??null,trip_period:period||'both',notes:row.notes??null,created_at:row.created_at??null});}
 return result;
}
export function approvedExcuseMap(rows:ApprovedDriverExcuse[]){return new Map(rows.map(row=>[String(row.student_id),row]));}
export function approvedExcuseLabel(requestType:unknown,isRTL:boolean){return normalize(requestType)==='no_bus'?(isRTL?'لن يستخدم الباص':'Not riding bus'):(isRTL?'مجاز / غائب':'Excused / Absent');}
