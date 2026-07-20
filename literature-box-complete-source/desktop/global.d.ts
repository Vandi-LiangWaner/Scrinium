export {};
declare global { interface Window { literatureBox?: { loadCards():Promise<unknown>; saveCards(cards:unknown):Promise<boolean>; exportFile(kind:string,body:string):Promise<boolean>; importFile():Promise<unknown>; dataLocation():Promise<string>; } } }
