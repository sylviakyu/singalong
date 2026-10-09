import type {Issue} from './types';
export class ApiError extends Error {
  constructor(message:string, public issues:Issue[] = [], public status = 0) {super(message)}
}
export async function api<T>(path:string, init?:RequestInit):Promise<T> {
  let response:Response;
  try {response = await fetch(`/api${path}`,{...init,headers:{'Content-Type':'application/json',...init?.headers}})}
  catch {throw new ApiError('無法連線到後端，請確認服務已啟動。')}
  if (!response.ok) {
    const body = await response.json().catch(()=>({}));
    throw new ApiError(typeof body.detail === 'string' ? body.detail : '資料驗證失敗，請檢查欄位。', Array.isArray(body.detail)?body.detail:[],response.status);
  }
  return response.status===204 ? undefined as T : response.json();
}
