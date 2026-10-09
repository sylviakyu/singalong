// @vitest-environment jsdom
import React,{createRef} from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {render,act,cleanup} from '@testing-library/react';
import {Player,type PlayerHandle} from '../src/Player';
vi.mock('../src/youtube',async(importOriginal)=>({...await importOriginal<typeof import('../src/youtube')>(),loadYouTube:()=>Promise.resolve()}));
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals()});
it('destroys the player and clears duration and sentence polling on unmount',async()=>{
  vi.useFakeTimers({toFake:['setInterval','clearInterval','setTimeout','clearTimeout']});
  const destroy=vi.fn();const pauseVideo=vi.fn();let options:YT.PlayerOptions|undefined;
  const fake={getDuration:()=>100,getCurrentTime:()=>10,getPlayerState:()=>1,seekTo:vi.fn(),playVideo:vi.fn(),pauseVideo,destroy};
  class MockPlayer {constructor(_element:unknown,config:YT.PlayerOptions){options=config;return fake}}
  window.YT={Player:MockPlayer} as unknown as typeof YT;
  const ref=createRef<PlayerHandle>();const view=render(<Player videoId="M7lc1UVf-VE" ref={ref}/>);
  await act(async()=>{await Promise.resolve()});
  act(()=>{options!.events!.onReady!({target:fake} as unknown as YT.PlayerEvent)});
  act(()=>{ref.current!.play(10,11);vi.advanceTimersByTime(100)});expect(vi.getTimerCount()).toBe(2);
  view.unmount();expect(destroy).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
  vi.advanceTimersByTime(1000);expect(pauseVideo).not.toHaveBeenCalled();
});
