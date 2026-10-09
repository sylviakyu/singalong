// @vitest-environment jsdom
import React from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {createMemoryRouter,RouterProvider} from 'react-router-dom';
import {Editor,SongList} from '../src/pages';
vi.mock('../src/Player',()=>({Player:()=> <div>Mock 播放器</div>}));
const fetchMock=vi.fn();
beforeEach(()=>vi.stubGlobal('fetch',fetchMock));
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.resetAllMocks()});
function editor(){const router=createMemoryRouter([{path:'/admin/songs/new',element:<Editor/>},{path:'/admin',element:<p>管理列表</p>},{path:'/admin/songs/:id/edit',element:<p>儲存完成頁面</p>}],{initialEntries:['/admin/songs/new']});render(<RouterProvider router={router}/>);return router}
function fill(){fireEvent.change(screen.getByLabelText('歌名'),{target:{value:'測試歌曲'}});fireEvent.change(screen.getByLabelText('歌手'),{target:{value:'測試歌手'}});fireEvent.change(screen.getByLabelText('YouTube 網址或影片 ID'),{target:{value:'https://youtu.be/M7lc1UVf-VE'}})}
it('saves a valid empty-lyrics song then leaves without a dirty warning',async()=>{
  fetchMock.mockResolvedValue({ok:true,status:201,json:async()=>({id:1,title:'測試歌曲',artist:'測試歌手'})});editor();fill();fireEvent.click(screen.getByText('儲存歌曲與全部歌詞'));
  await screen.findByText('儲存完成頁面');expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({youtube_video_id:'M7lc1UVf-VE',lyrics:[]});
});
it('keeps unsaved inputs after field errors and API failure',async()=>{
  editor();fill();fireEvent.click(screen.getByText('＋ 新增一列'));fireEvent.click(screen.getByText('儲存歌曲與全部歌詞'));
  expect(await screen.findByText('結束秒數必須大於開始秒數')).toBeTruthy();expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('第 1 列結束秒數'),{target:{value:'2'}});fireEvent.change(screen.getByLabelText('第 1 列韓文'),{target:{value:'안녕'}});
  fetchMock.mockResolvedValue({ok:false,status:422,json:async()=>({detail:[{loc:['body','lyrics',0,'korean'],msg:'測試欄位錯誤'}]})});fireEvent.click(screen.getByText('儲存歌曲與全部歌詞'));
  expect(await screen.findByText('測試欄位錯誤')).toBeTruthy();expect((screen.getByLabelText('歌名') as HTMLInputElement).value).toBe('測試歌曲');expect((screen.getByLabelText('第 1 列韓文') as HTMLTextAreaElement).value).toBe('안녕');
});
it('blocks leaving a dirty editor and allows staying or discarding',async()=>{
  editor();fill();fireEvent.click(screen.getByText('← 返回管理頁'));expect(await screen.findByRole('alertdialog')).toBeTruthy();fireEvent.click(screen.getByText('繼續編輯'));expect(screen.queryByRole('alertdialog')).toBeNull();fireEvent.click(screen.getByText('← 返回管理頁'));fireEvent.click(screen.getByText('放棄變更並離開'));expect(await screen.findByText('管理列表')).toBeTruthy();
});
it('normalizes an out-of-range page to the last valid page',async()=>{
  fetchMock.mockImplementation(async(input:string)=>({ok:true,status:200,json:async()=>input.endsWith('page=3')?{items:[],total:21,total_pages:2}:{items:[{id:1,title:'歌曲',artist:'歌手'}],total:21,total_pages:2}}));
  const router=createMemoryRouter([{path:'/songs',element:<SongList/>}],{initialEntries:['/songs?page=3']});render(<RouterProvider router={router}/>);
  await screen.findByText('歌曲');await waitFor(()=>expect(router.state.location.search).toBe('?page=2'));
});
