// @ts-nocheck
// Mocks to satisfy both runtime execution AND TypeScript static checks.
// Uses 'string | number | boolean | object | undefined | null' to avoid strict signature mismatches with legacy experiment decorators.
export function Controller(_path: string): string | number | boolean | object | undefined | null {
    void _path;
    return () => {};
}

export function Get(_path?: string): string | number | boolean | object | undefined | null {
    void _path;
    return () => {};
}

export function Post(_path?: string): string | number | boolean | object | undefined | null {
    void _path;
    return () => {};
}

export function Param(_name?: string): string | number | boolean | object | undefined | null {
    void _name;
    return () => {};
}

export function Query(_name?: string): string | number | boolean | object | undefined | null;
export function Query(_path?: string): string | number | boolean | object | undefined | null;
export function Query(_arg?: string): string | number | boolean | object | undefined | null {
    void _arg;
    return () => {};
}

export function Header(_name?: string): string | number | boolean | object | undefined | null {
    void _name;
    return () => {};
}

export function Body(): string | number | boolean | object | undefined | null {
    return () => {};
}

export function HttpCode(_code: number): string | number | boolean | object | undefined | null {
    void _code;
    return () => {};
}

export interface CreateWidget {
    name: string;
}

export interface Widget {
    id: string;
    name: string;
}

@Controller('/admin')
export class AdminController {
    /**
     * Create widget.
     *
     * Accepts the widget body.
     */
    @Post('/widgets/:id')
    @HttpCode(201)
    create(
        @Param('id') id: string,
        @Body() body: CreateWidget,
        @Header('X-Trace') trace?: string,
        @Query('mode') mode?: string,
    ): Widget {
        void trace;
        void mode;
        return { id, name: body.name };
    }

    @Get()
    list() {
        return [];
    }

    @Query('/search')
    search(@Query('q') q?: string) {
        return { q };
    }
}
