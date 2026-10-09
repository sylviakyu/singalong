import React from 'react';
import {createRoot} from 'react-dom/client';
import {createBrowserRouter,RouterProvider,Navigate,Outlet,Link} from 'react-router-dom';
import {SongList,Singalong,Editor} from './pages';
import './style.css';
function Layout(){return <><header><Link className="brand" to="/songs"><span>한</span> 韓文跟唱練習室</Link><nav><Link to="/songs">全部歌曲</Link><Link to="/admin">管理歌曲</Link></nav></header><main><Outlet/></main><footer>跟著每一句，慢慢練習。 · YouTube 播放需要網路連線</footer></>}
const router=createBrowserRouter([{element:<Layout/>,children:[{path:'/',element:<Navigate to="/songs" replace/>},{path:'/songs',element:<SongList/>},{path:'/songs/:id',element:<Singalong/>},{path:'/admin',element:<SongList admin/>},{path:'/admin/songs/new',element:<Editor/>},{path:'/admin/songs/:id/edit',element:<Editor/>},{path:'*',element:<p>找不到頁面。<Link to="/songs">返回歌曲列表</Link></p>}]}]);
createRoot(document.getElementById('root')!).render(<React.StrictMode><RouterProvider router={router}/></React.StrictMode>);
