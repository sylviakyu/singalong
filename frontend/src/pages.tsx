import {useEffect,useRef,useState} from 'react';
import {Link,useParams,useSearchParams,useNavigate,useBlocker} from 'react-router-dom';
import {api,ApiError} from './api';
import type {Song,SongInput,SongPage,Lyric} from './types';
import {Player,type PlayerHandle} from './Player';
import {parseVideoId} from './youtube';
const empty:SongInput={title:'',artist:'',youtube_video_id:'',lyrics:[]};
const blank=():Lyric=>({start_seconds:0,end_seconds:0,korean:'',chinese:'',romanization:''});
const errorText=(e:unknown)=>e instanceof Error?e.message:'發生錯誤，請再試一次。';
export function SongList({admin=false}:{admin?:boolean}) {
  const [params,setParams]=useSearchParams();const requested=Number(params.get('page')||1);const page=Number.isInteger(requested)&&requested>0?requested:1;
  const [data,setData]=useState<SongPage>();const [error,setError]=useState('');const [revision,setRevision]=useState(0);const [loading,setLoading]=useState(true);const [deleting,setDeleting]=useState<number>();
  useEffect(()=>{let active=true;setLoading(true);setError('');api<SongPage>(`/songs?page=${page}`).then(result=>{
    if(!active)return;
    if(page>Math.max(1,result.total_pages)){setParams({page:String(Math.max(1,result.total_pages))},{replace:true});return}
    setData(result);
  }).catch(e=>{if(active)setError(errorText(e))}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[page,revision,setParams]);
  async function remove(song:SongPage['items'][number]) {
    if(!window.confirm(`確定刪除「${song.title}」？歌曲及全部歌詞會一併刪除。`))return;
    setDeleting(song.id);try{await api(`/songs/${song.id}`,{method:'DELETE'});setRevision(v=>v+1)}catch(e){setError(errorText(e))}finally{setDeleting(undefined)}
  }
  return <><div className="heading"><div><p className="eyebrow">YOUR PRACTICE ROOM</p><h1>{admin?'管理歌曲':'全部歌曲'}</h1><p>韓文、中文與拼音，一句一句練習。</p></div>{admin&&<Link className="button" to="/admin/songs/new">＋ 新增歌曲</Link>}</div>
    {error&&<div className="error" role="alert">{error} <button onClick={()=>setRevision(v=>v+1)}>重新載入</button></div>}
    {loading?<p role="status">正在載入歌曲…</p>:data&&<>{data.items.length===0?<div className="empty"><h2>還沒有歌曲</h2><p>先新增一首歌曲，再整理你的逐句歌詞。</p><Link to="/admin/songs/new" className="button">新增第一首歌曲</Link></div>:<div className="song-grid">{data.items.map(song=><article className="song-card" key={song.id}><span className="song-number">#{String(song.id).padStart(3,'0')}</span><h2>{song.title}</h2><p>{song.artist}</p><div className="actions"><Link className="button" to={`/songs/${song.id}`}>開始跟唱 →</Link>{admin&&<><Link to={`/admin/songs/${song.id}/edit`}>編輯</Link><button className="danger" disabled={deleting!==undefined} onClick={()=>remove(song)}>{deleting===song.id?'刪除中…':'刪除'}</button></>}</div></article>)}</div>}
    <div className="pagination"><button disabled={page<=1} onClick={()=>setParams({page:String(page-1)})}>上一頁</button><span>第 {data.total_pages? page:0} / {data.total_pages} 頁 · 共 {data.total} 首</span><button disabled={page>=data.total_pages} onClick={()=>setParams({page:String(page+1)})}>下一頁</button></div></>}
  </>;
}
function useSong(id:string|undefined){
  const [song,setSong]=useState<Song>();const [error,setError]=useState('');
  useEffect(()=>{let active=true;setSong(undefined);setError('');if(id)api<Song>(`/songs/${id}`).then(s=>{if(active)setSong(s)}).catch(e=>{if(active)setError(errorText(e))});return()=>{active=false}},[id]);
  return {song,error};
}
export function Singalong(){
  const {id}=useParams();const {song,error}=useSong(id);const player=useRef<PlayerHandle>(null);const [ready,setReady]=useState(false);
  const [duration,setDuration]=useState(0);const [notice,setNotice]=useState('');
  useEffect(()=>{setReady(false);setDuration(0);setNotice('')},[id]);
  function play(line:Lyric){if(duration>0&&line.end_seconds>duration){setNotice('這句時間超過影片長度，請到管理頁修正。');return}setNotice('');player.current?.play(line.start_seconds,line.end_seconds)}
  if(error)return <p className="error" role="alert">{error} <Link to="/songs">返回列表</Link></p>;
  if(!song)return <p role="status">正在載入歌曲…</p>;
  return <><Link to="/songs">← 返回歌曲列表</Link><div className="heading"><div><p className="eyebrow">SING ALONG</p><h1>{song.title}</h1><p>{song.artist}</p></div><Link to={`/admin/songs/${song.id}/edit`}>編輯歌詞</Link></div><Player key={song.id} videoId={song.youtube_video_id} ref={player} onReady={setReady} onDuration={setDuration}/><div className="actions toolbar"><button disabled={!ready} onClick={()=>player.current?.whole()}>▶ 整首播放</button><button disabled={!ready} onClick={()=>player.current?.pause()}>暫停</button></div>{notice&&<p className="error" role="alert">{notice}</p>}<h2>逐句練習 <small>{song.lyrics.length} 句</small></h2>{song.lyrics.length===0?<div className="empty">尚未新增歌詞</div>:song.lyrics.map((line,i)=><article className="lyric" key={i}><div className="line-index">{String(i+1).padStart(2,'0')}<small>{line.start_seconds.toFixed(2)}–{line.end_seconds.toFixed(2)} 秒</small></div><div className="line-text"><p className="korean" lang="ko">{line.korean}</p>{line.chinese&&<p>{line.chinese}</p>}{line.romanization&&<p className="romanization">{line.romanization}</p>}</div><div className="actions"><button disabled={!ready} onClick={()=>play(line)}>▶ 播放這句</button><button disabled={!ready} onClick={()=>player.current?.pause()}>暫停</button></div></article>)}</>;
}
export function Editor(){
  const {id}=useParams();const navigate=useNavigate();const {song,error:loadError}=useSong(id);
  const [form,setForm]=useState<SongInput>(empty);const [source,setSource]=useState('');const [video,setVideo]=useState('');const [baseline,setBaseline]=useState('');
  const [ready,setReady]=useState(false);const [duration,setDuration]=useState(0);const [saving,setSaving]=useState(false);const [notice,setNotice]=useState('');const [errors,setErrors]=useState<Record<string,string>>({});
  const player=useRef<PlayerHandle>(null);
  const snapshot=JSON.stringify({form,source});const dirty=baseline!==''&&snapshot!==baseline;
  const dirtyRef=useRef(dirty);dirtyRef.current=dirty;
  const blocker=useBlocker(()=>dirtyRef.current);
  useEffect(()=>{const next=song?{title:song.title,artist:song.artist,youtube_video_id:song.youtube_video_id,lyrics:song.lyrics.map(l=>({start_seconds:l.start_seconds,end_seconds:l.end_seconds,korean:l.korean,chinese:l.chinese,romanization:l.romanization}))}:empty;
    if(id&&!song)return;setForm(next);setSource(next.youtube_video_id);setVideo(next.youtube_video_id);setBaseline(JSON.stringify({form:next,source:next.youtube_video_id}));setDuration(0);setNotice('');setErrors({});
  },[song,id]);
  useEffect(()=>{const leave=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue=''}};window.addEventListener('beforeunload',leave);return()=>window.removeEventListener('beforeunload',leave)},[dirty]);
  function loadVideo(){try{const parsed=parseVideoId(source);if(parsed!==video){setReady(false);setDuration(0)}setVideo(parsed);setForm(f=>({...f,youtube_video_id:parsed}));setErrors({})}catch(e){setErrors({youtube_video_id:errorText(e)})}}
  function patch(index:number,values:Partial<Lyric>){setForm(f=>({...f,lyrics:f.lyrics.map((line,i)=>i===index?{...line,...values}:line)}))}
  function move(index:number,delta:number){setForm(f=>{const lines=[...f.lyrics];[lines[index],lines[index+delta]]=[lines[index+delta],lines[index]];return {...f,lyrics:lines}})}
  function validateLine(line:Lyric,i:number,checkOrder=true){const result:Record<string,string>={};
    if(!Number.isFinite(line.start_seconds)||line.start_seconds<0)result[`lyrics.${i}.start_seconds`]='開始秒數必須是非負有限數值';
    if(!Number.isFinite(line.end_seconds)||line.end_seconds<=line.start_seconds)result[`lyrics.${i}.end_seconds`]='結束秒數必須大於開始秒數';
    if(duration>0&&video===parseVideoIdSafe(source)&&line.end_seconds>duration)result[`lyrics.${i}.end_seconds`]='時間超過影片長度';
    if(!line.korean.trim())result[`lyrics.${i}.korean`]='請輸入韓文';
    if(checkOrder&&i>0&&line.start_seconds<form.lyrics[i-1].start_seconds)result[`lyrics.${i}.start_seconds`]='開始時間不得早於上一列';
    return result;
  }
  function preview(i:number){const found=validateLine(form.lyrics[i],i,false);setErrors(found);if(Object.keys(found).length===0)player.current?.play(form.lyrics[i].start_seconds,form.lyrics[i].end_seconds)}
  async function save(){
    const found:Record<string,string>={};if(!form.title.trim()||form.title.trim().length>200)found.title='請輸入 1–200 字元歌名';if(!form.artist.trim()||form.artist.trim().length>200)found.artist='請輸入 1–200 字元歌手';
    let parsed='';try{parsed=parseVideoId(source)}catch(e){found.youtube_video_id=errorText(e)}
    form.lyrics.forEach((l,i)=>Object.assign(found,validateLine(l,i)));setErrors(found);setNotice('');if(Object.keys(found).length)return;
    setSaving(true);try{const payload={...form,youtube_video_id:parsed};const saved=await api<Song>(id?`/songs/${id}`:'/songs',{method:id?'PUT':'POST',body:JSON.stringify(payload)});
      const next={...payload,title:saved.title,artist:saved.artist};setForm(next);setBaseline(JSON.stringify({form:next,source}));setNotice('已儲存歌曲與全部歌詞。');if(!id){dirtyRef.current=false;navigate(`/admin/songs/${saved.id}/edit`,{replace:true})}
    }catch(e){if(e instanceof ApiError){setErrors(Object.fromEntries(e.issues.map(issue=>[issue.loc.filter(k=>k!=='body').join('.'),issue.msg])))}setNotice(errorText(e))}finally{setSaving(false)}
  }
  const fieldError=(key:string)=>errors[key]&&<small className="field-error" role="alert">{errors[key]}</small>;
  if(loadError)return <p className="error">{loadError} <Link to="/admin">返回管理頁</Link></p>;
  if(id&&!song)return <p>正在載入歌曲…</p>;
  return <><Link to="/admin">← 返回管理頁</Link><div className="heading"><div><p className="eyebrow">SONG EDITOR</p><h1>{id?'編輯歌曲':'新增歌曲'}</h1><p>先載入影片，再整理每一句的文字與時間。</p></div><span>{dirty?'尚未儲存':'所有變更已儲存'}</span></div>
    <fieldset disabled={saving}><div className="form-grid"><label>歌名<input maxLength={200} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/>{fieldError('title')}</label><label>歌手<input maxLength={200} value={form.artist} onChange={e=>setForm({...form,artist:e.target.value})}/>{fieldError('artist')}</label><label className="wide">YouTube 網址或影片 ID<div className="source-row"><input value={source} onChange={e=>setSource(e.target.value)} placeholder="https://www.youtube.com/watch?v=…"/><button onClick={loadVideo}>載入影片</button></div>{fieldError('youtube_video_id')}</label></div>
    {video&&<><Player key={video} videoId={video} ref={player} onReady={setReady} onDuration={setDuration}/><p>影片長度：{duration>0?`${duration.toFixed(2)} 秒`:'播放後取得'} <button disabled={!ready} onClick={()=>player.current?.pause()}>暫停</button></p></>}
    <div className="heading"><h2>歌詞與時間軸</h2><button onClick={()=>setForm({...form,lyrics:[...form.lyrics,blank()]})}>＋ 新增一列</button></div>{fieldError('lyrics')}
    {!form.lyrics.length&&<p className="empty">目前沒有歌詞，可先儲存歌曲，之後再補齊。</p>}
    {!!form.lyrics.length&&<div className="table-scroll"><table><thead><tr><th>順序</th><th>開始秒數</th><th>結束秒數</th><th>韓文 *</th><th>中文</th><th>羅馬拼音</th><th>操作</th></tr></thead><tbody>{form.lyrics.map((line,i)=><tr key={i}><td>{i+1}<div className="stack"><button aria-label={`第 ${i+1} 列上移`} disabled={i===0} onClick={()=>move(i,-1)}>↑</button><button aria-label={`第 ${i+1} 列下移`} disabled={i===form.lyrics.length-1} onClick={()=>move(i,1)}>↓</button></div></td>{(['start_seconds','end_seconds'] as const).map(key=><td key={key}><input aria-label={`第 ${i+1} 列${key==='start_seconds'?'開始':'結束'}秒數`} type="number" min="0" step="0.01" value={Number.isNaN(line[key])?'':line[key]} onChange={e=>patch(i,{[key]:e.target.value===''?NaN:Number(e.target.value)})}/>{fieldError(`lyrics.${i}.${key}`)}<button disabled={!ready||video!==parseVideoIdSafe(source)} onClick={()=>patch(i,{[key]:Number((player.current?.time()??0).toFixed(2))})}>記錄目前時間</button></td>)}{(['korean','chinese','romanization'] as const).map(key=><td key={key}><textarea aria-label={`第 ${i+1} 列${key==='korean'?'韓文':key==='chinese'?'中文':'羅馬拼音'}`} value={line[key]} onChange={e=>patch(i,{[key]:e.target.value})}/>{fieldError(`lyrics.${i}.${key}`)}</td>)}<td className="stack"><button disabled={!ready||video!==parseVideoIdSafe(source)} onClick={()=>preview(i)}>試播這句</button><button disabled={!ready} onClick={()=>player.current?.pause()}>暫停</button><button className="danger" onClick={()=>setForm({...form,lyrics:form.lyrics.filter((_,index)=>index!==i)})}>刪除列</button></td></tr>)}</tbody></table></div>}
    <div className="save-bar"><span role="status">{notice}</span><button className="primary" onClick={save} disabled={saving}>{saving?'儲存中…':'儲存歌曲與全部歌詞'}</button></div></fieldset>
    {blocker.state==='blocked'&&<div className="modal-backdrop"><div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="leave-title"><h2 id="leave-title">尚有未儲存的內容</h2><p>離開後將失去這些變更。</p><div className="actions"><button autoFocus onClick={()=>blocker.reset()}>繼續編輯</button><button className="danger" onClick={()=>blocker.proceed()}>放棄變更並離開</button></div></div></div>}
  </>;
}
function parseVideoIdSafe(source:string){try{return parseVideoId(source)}catch{return ''}}
