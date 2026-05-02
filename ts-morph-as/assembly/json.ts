import { JSON } from 'assemblyscript-json/assembly';

export class Config {
    openapi: string = '';

    static parse(jsonString: string): Config {
        let jsonObj = <JSON.Obj>JSON.parse(jsonString);
        let cfg = new Config();
        let openapi = jsonObj.getString('openapi');
        if (openapi) cfg.openapi = openapi.valueOf();
        return cfg;
    }
}
