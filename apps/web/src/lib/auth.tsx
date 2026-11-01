import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, setToken, type User, type AppConfig } from '../api/client';
interface AuthState {user:User|null;loading:boolean;config:AppConfig|null;error:string;login:(userId:string)=>Promise<void>;signIn:(email:string,password:string,name?:string,invitation?:string)=>Promise<void>;logout:()=>Promise<void>;}
const Ctx=createContext<AuthState>({user:null,loading:true,config:null,error:'',login:async()=>{},signIn:async()=>{},logout:async()=>{}});
export function AuthProvider({children}:{children:ReactNode}){
 const [user,setUser]=useState<User|null>(null);const [loading,setLoading]=useState(true);const [config,setConfig]=useState<AppConfig|null>(null);const [error,setError]=useState('');const queries=useQueryClient();
 useEffect(()=>{let cancelled=false;
  (async()=>{try{const cfg=await api.authConfig();if(cancelled)return;setConfig(cfg);if(cfg.appMode==='product')setToken(null);try{const u=await api.me();if(!cancelled)setUser(u);}catch{setToken(null);}}catch(e){if(!cancelled)setError((e as Error).message);}finally{if(!cancelled)setLoading(false);}})();
  return()=>{cancelled=true;};
 },[]);
 const login=async(id:string)=>{const r=await api.login(id);setToken(r.token);setUser(r.user);};
 const signIn=async(email:string,password:string,name?:string,invitation?:string)=>{
  const r=invitation?await api.acceptInvitation(invitation,password):config?.setupRequired?await api.setupAccount(name!,email,password):await api.passwordLogin(email,password);
  queries.clear();setToken(null);setUser(r.user);setConfig(c=>c?{...c,setupRequired:false}:c);
 };
 const logout=async()=>{if(config?.appMode==='product')await api.logout();setToken(null);setUser(null);queries.clear();};
 return <Ctx.Provider value={{user,loading,config,error,login,signIn,logout}}>{children}</Ctx.Provider>;
}
export const useAuth=()=>useContext(Ctx);
export const can=(user:User|null,...roles:User['role'][])=>!!user&&(user.role==='admin'||roles.includes(user.role));
