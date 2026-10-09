export type Lyric = {start_seconds:number;end_seconds:number;korean:string;chinese:string;romanization:string};
export type SongInput = {title:string;artist:string;youtube_video_id:string;lyrics:Lyric[]};
export type Song = SongInput & {id:number;created_at:string;updated_at:string};
export type Summary = Pick<Song,'id'|'title'|'artist'|'youtube_video_id'>;
export type SongPage = {items:Summary[];page:number;total:number;total_pages:number};
export type Issue = {loc:(string|number)[];msg:string};
