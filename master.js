function rotated_rectangle(width, height, angle) {
    let half_width = width / 2;
    let half_height = height / 2;
    let corners = [
        [-half_width, -half_height],
        [-half_width, half_height],
        [half_width, half_height],
        [half_width, -half_height]
    ];
    let rotated = [];
    for (let k = 0; k < 4; k++) {
        let cx = corners[k][0];
        let cy = corners[k][1];
        let rx = cx * Math.cos(angle) + cy * Math.sin(angle);
        let ry = -cx * Math.sin(angle) + cy * Math.cos(angle);
        rotated.push([rx, ry]);
    }
    return rotated;
}


function rotated_square(size, angle) {
    return rotated_rectangle(size, size, angle);
}


function draw_rotated_square(context, cx, cy, size, angle) {
    let square = rotated_square(size, angle);
    context.beginPath();
    context.moveTo(square[0][0] + cx, square[0][1] + cy);
    for (let k = 1; k <= 4; k++) {
        context.lineTo(square[k % 4][0] + cx, square[k % 4][1] + cy);
    }
}


function draw_rotated_rectangle(context, cx, cy, width, height, angle) {
    let rectangle = rotated_rectangle(width, height, angle);
    context.beginPath();
    context.moveTo(rectangle[0][0] + cx, rectangle[0][1] + cy);
    for (let k = 1; k <= 4; k++) {
        context.lineTo(rectangle[k % 4][0] + cx, rectangle[k % 4][1] + cy);
    }
}


function is_integer(x) {
    return Math.floor(x) == x;
}


class LagrangeInterpolation {

    /* Adapted from https://gist.github.com/dburner/8550030 */

    constructor(xys) {
        this.xs = [];
        this.ys = [];
        xys.forEach(xy => {
            this.xs.push(xy[0]);
            this.ys.push(xy[1]);
        });
        this.ws = [];
        this.update_weights();
    }

    update_weights() {
        this.ws = [];
        let k = this.xs.length;
        let w;
        for (let j = 0; j < k; ++j) {
            w = 1;
            for (let i = 0; i < k; ++i) {
                if (i != j) {
                    w *= this.xs[j] - this.xs[i];
                }
            }
            this.ws[j] = 1 / w;
        }
    }

    f(x) {
        let a = 0;
        let b = 0;
        let c = 0;
        for (let j = 0; j < this.xs.length; ++j) {
            if (x != this.xs[j]) {
                a = this.ws[j] / (x - this.xs[j]);
                b += a * this.ys[j];
                c += a;
            } else {
                return this.ys[j];
            }
        }
        return b / c;
    }

    export_config() {
        return {
            xs: this.xs,
            ys: this.ys,
        }
    }

    load_config(config) {
        this.xs = config.xs;
        this.ys = config.ys;
        this.update_weights();
    }

}


class CurveInput {

    constructor(callback) {
        this.callback = callback;
        this.dots = [[0, 0], [1, 1]];
        this.canvas = null;
        this.context = null;
        this.size = 224;
        this.padding = 16;
        this.radius = 4;
        this.tol = 2 * this.radius / this.size;
        this.dragging = false;
        this.moving_dot = null;
    }

    cursor_position(event) {
        let bounds = this.canvas.getBoundingClientRect();
        return [
            Math.max(0, Math.min(1, (event.clientX - bounds.left - this.padding) / this.size)),
            1 - Math.max(0, Math.min(1, (event.clientY - bounds.top - this.padding) / this.size))
        ];
    }

    setup(container) {
        this.canvas = document.createElement("canvas");
        this.canvas.classList.add("curve-input");
        this.canvas.width = this.size + 2 * this.padding;
        this.canvas.height = this.size + 2 * this.padding;
        container.appendChild(this.canvas);
        this.context = this.canvas.getContext("2d");
        var self = this;
        
        this.canvas.addEventListener("mousedown", (event) => {
            self.dragging = true;
            let pos = self.cursor_position(event);
            for (let i = 0; i < self.dots.length; i++) {
                if (Math.abs(self.dots[i][0] - pos[0]) + Math.abs(self.dots[i][1] - pos[1]) <= self.tol) {
                    self.moving_dot = i;
                    break;
                }
            }
            if (self.moving_dot == null) {
                self.dots.push([pos[0], pos[1]]);
                self.dots.sort((a, b) => { return a[0] - b[0]; });
                for (let i = 0; i < self.dots.length; i++) {
                    if (self.dots[i][0] == pos[0] && self.dots[i][1] == pos[1]) {
                        self.moving_dot = i;
                        break;
                    }
                }
            }
            self.dots[self.moving_dot] == [pos[0], pos[1]];
            self.update();
        });

        this.canvas.addEventListener("mousemove", (event) => {
            if (!self.dragging) return;
            let pos = self.cursor_position(event);
            self.dots[self.moving_dot] = [pos[0], pos[1]];
            self.update();
        });

        this.canvas.addEventListener("mouseup", (event) => {
            self.dragging = false;
            self.moving_dot = null;
            self.update();
        });

        this.canvas.addEventListener("mouseleave", (event) => {
            self.dragging = false;
            self.moving_dot = null;
            self.update();
        });

        this.canvas.addEventListener("click", (event) => {
            if (!event.shiftKey) return;
            let pos = self.cursor_position(event);
            let remove_index = null;
            for (let i = 0; i < self.dots.length; i++) {
                if (Math.abs(self.dots[i][0] - pos[0]) + Math.abs(self.dots[i][1] - pos[1]) <= self.tol) {
                    remove_index = i;
                    break;
                }
            }
            if (remove_index != null) {
                self.dots.splice(remove_index, 1);
                self.update();
            }
        });

        this.canvas.addEventListener("dblclick", (event) => {
            self.dots = [[0, 0], [1, 1]];
            self.update();
        });

    }

    update(trigger_callback=true) {
        let color = "white";
        if (document.body.classList.contains("light")) {
            color = "black";
        }
        this.context.fillStyle = color;
        this.context.strokeStyle = color;

        this.context.clearRect(0, 0, this.size + 2 * this.padding, this.size + 2 * this.padding);
        this.dots.forEach(dot => {
            let x = dot[0] * this.size - this.radius + this.padding;
            let y = (1 - dot[1]) * this.size - this.radius + this.padding;
            this.context.fillRect(x, y, 2 * this.radius, 2 * this.radius);
        });

        let sdots = [...this.dots];
        if (sdots[0][0] != 0) {
            sdots.splice(0, 0, [0, 0]);
        }
        if (sdots[sdots.length - 1][0] != 1) {
            sdots.push([1, 1]);
        }

        let interpolation = new LagrangeInterpolation(sdots);
        this.context.beginPath();
        this.context.moveTo(this.padding, this.size + this.padding);

        for (let i = 0; i < this.size; i++) {
            let x = i / (this.size - 1);
            let y = interpolation.f(x);
            this.context.lineTo(
                x * this.size + this.padding,
                (1 - y) * this.size + this.padding
            );
        }
        this.context.stroke();
        
        if (trigger_callback) {
            this.callback(interpolation);
        }

    }

}


class Texture {

    constructor(size, relsize) {
        this.size = size;
        this.relsize = relsize;
        this.grid = [];
        for (let i = 0; i < this.size; i++) {
            this.grid.push([]);
            for (let j = 0; j < this.size; j++) {
                this.grid[i].push(0);
            }
        }
    }

    draw(context, x, y, grid_size, angle) {
        let scale = grid_size / this.size * this.relsize;
        for (let i = 0; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                if (this.grid[i][j] == 0) {
                    continue;
                }
                let cx_base = x + (j - this.size / 2 + .5) * scale;
                let cy_base = y + (i - this.size / 2 + .5) * scale;
                let cx = (cx_base - x) * Math.cos(angle) + (cy_base - y) * Math.sin(angle) + x;
                let cy = -(cx_base - x) * Math.sin(angle) + (cy_base - y) * Math.cos(angle) + y;
                draw_rotated_square(context, cx, cy, scale, angle);
                context.fill();
            }
        }
    }

}


function create_dot_texture_pack(dot_size) {
    // Requires a symmetric 2D function
    let grid = [];
    for (let k = 0; k < dot_size; k++) {
        for (let l = 0; l < dot_size; l++) {
            let i = k - dot_size / 2;
            let j = l - dot_size / 2;
            //let strength = Math.sqrt(Math.pow(i, 2) + Math.pow(j, 2)) - Math.sqrt(Math.pow(i, -4) + Math.pow(j, -4));
            let strength = Math.sqrt(Math.pow(i, 2) + Math.pow(j, 2));
            grid.push([k, l, strength]);
        }
    }
    grid.sort((a, b) => { return a[2] - b[2]; });
    let texture_pack = [];
    for (let bound = 0; bound <= dot_size * dot_size; bound++) {
        let texture = new Texture(dot_size, 1);
        for (let m = 0; m < bound; m++) {
            let k = grid[m][0];
            let l = grid[m][1];
            texture.grid[k][l] = 1;
        }
        texture_pack.push(texture);
    }
    return texture_pack;
}


function create_euclidean_texture_pack(dot_size) {
    // Euclidean
    let texture_pack = [];
    for (let bound = 0; bound <= dot_size * dot_size; bound++) {
        let intensity = bound / dot_size / dot_size;
        let p = 2 + 0 * Math.exp(-Math.pow(intensity - 0.5, 2) / 0.005);
        let grid = [];
        for (let k = 0; k < dot_size; k++) {
            for (let l = 0; l < dot_size; l++) {
                let i = k - dot_size / 2;
                let j = l - dot_size / 2;
                let strength = Math.pow(Math.pow(i, p) + Math.pow(j, p), 1/p);
                grid.push([k + dot_size, l + dot_size, strength]);
            }
        }
        grid.sort((a, b) => { return a[2] - b[2]; });

        let texture = new Texture(3 * dot_size, 3);
        let hds = dot_size / 2;
    
        if (bound < dot_size * dot_size / 2) {
            for (let m = 0; m < bound * 2; m++) {
                let k = grid[m][0];
                let l = grid[m][1];
                texture.grid[k][l] = 1;
            }
        } else {
            for (let k = dot_size; k < 2*dot_size; k++) {
                for (let l = dot_size; l < 2*dot_size; l++) {
                    texture.grid[k][l] = 1;
                }
            }
            let offset_bound = dot_size * dot_size - bound;
            for (let m = offset_bound * 2; m < grid.length; m++) {
                let k = grid[m][0];
                let l = grid[m][1];
                let kk = k - dot_size;
                let ll = l - dot_size;
                if (kk >= hds) texture.grid[k - dot_size][l] = 1;
                if (kk <= hds) texture.grid[k + dot_size][l] = 1;
                if (ll >= hds) texture.grid[k][l - dot_size] = 1;
                if (ll <= hds) texture.grid[k][l + dot_size] = 1;
                if (kk >= hds && ll >= hds) texture.grid[k - dot_size][l - dot_size] = 1;
                if (kk >= hds && ll <= hds) texture.grid[k - dot_size][l + dot_size] = 1;
                if (kk <= hds && ll >= hds) texture.grid[k + dot_size][l - dot_size] = 1;
                if (kk <= hds && ll <= hds) texture.grid[k + dot_size][l + dot_size] = 1;
            }
        }

        texture_pack.push(texture);
    }
    return texture_pack;
}

function compute_index_matrix(n) {
    /* Note: n must be a power of two
       Returns a square matrix of size n
    */
    if (n == 2) return [[1, 2], [3, 0]];
    let m = Math.floor(n / 2);
    let inner_matrix = compute_index_matrix(m);
    let matrix = [];
    for (let i = 0; i < n; i++) {
        matrix.push([]);
        for (let j = 0; j < n; j++) {
            matrix[i].push(0);
        }
    }
    for (let i = 0; i < m; i++) {
        for (let j = 0; j < m; j++) {
            matrix[i][j] = 4 * inner_matrix[i][j] + 1;
            matrix[i + m][j] = 4 * inner_matrix[i][j] + 3;
            matrix[i][j + m] = 4 * inner_matrix[i][j] + 2;
            matrix[i + m][j + m] = 4 * inner_matrix[i][j];
        }
    }
    return matrix;
}


function create_bayer_texture_pack(dot_size) {
    let texture_pack = [];
    let n = Math.pow(2, Math.floor(Math.log2(dot_size)));
    let index_matrix = compute_index_matrix(n);
    for (let bound = 0; bound <= dot_size * dot_size; bound++) {
        let texture = new Texture(dot_size, 1);
        for (let i = 0; i < dot_size; i++) {
            for (let j = 0; j < dot_size; j++) {
                if (index_matrix[i][j] <= bound) {
                    texture.grid[i][j] = 1;
                }
            }
        }
        texture_pack.push(texture);
    }
    return texture_pack;
}


const DOT_TEXTURE_PACK = create_dot_texture_pack(10);
const EUCLIDEAN_TEXTURE_PACK = create_euclidean_texture_pack(10);
const BAYER4_TEXTURE_PACK = create_bayer_texture_pack(4);
const BAYER8_TEXTURE_PACK = create_bayer_texture_pack(8);
var COPIED_STRING = null;


class Screen {
    constructor(index, controller) {
        this.index = index;
        this.controller = controller;
        this.angle_degree = 30;
        this.grid_size = 16;
        this.raster_size = 1;
        this.show_grid = false;
        this.interlaced = true;
        this.dot_style = "circle";
        this.collapsed = false;
        this.color = "#000000";
        this.element = null;
        this.channel = "darkness";
        this.toggled = true;
        this.negative = false;
        this.offset_x = 0;
        this.offset_y = 0;
        this.animation_offset = 0;
        this.animated = false;
        this.tone_curve = new LagrangeInterpolation([[0, 0], [1, 1]]);
        this.canvas = document.createElement("canvas");
        this.context = this.canvas.getContext("2d");
    }

    export_config() {
        return {
            index: this.index,
            angle_degree: this.angle_degree,
            grid_size: this.grid_size,
            raster_size: this.raster_size,
            show_grid: this.show_grid,
            interlaced: this.interlaced,
            dot_style: this.dot_style,
            collapsed: this.collapsed,
            color: this.color,
            channel: this.channel,
            toggled: this.toggled,
            negative: this.negative,
            offset_x: this.offset_x,
            offset_y: this.offset_y,
            tone_curve: this.tone_curve.export_config(),
        };
    }

    load_config(config) {
        this.angle_degree = config.angle_degree;
        this.grid_size = config.grid_size;
        this.raster_size = config.raster_size;
        this.show_grid = config.show_grid;
        this.interlaced = config.interlaced;
        this.dot_style = config.dot_style;
        this.collapsed = config.collapsed;
        this.color = config.color;
        this.channel = config.channel;
        this.toggled = config.toggled;
        this.negative = config.negative;
        this.offset_x = config.offset_x;
        this.offset_y = config.offset_y;
        this.tone_curve.load_config(config.tone_curve);
    }

    create_element() {
        this.element = document.createElement("div");
        this.element.classList.add("screen");
        this.element.classList.add("panel");
        document.getElementById("screen-panels").appendChild(this.element);
        
        let title = document.createElement("div");
        title.classList.add("panel-title");
        title.textContent = `Screen #${ this.index }`;
        this.element.appendChild(title);
        let body = document.createElement("div");
        body.classList.add("panel-body");
        this.element.appendChild(body);

        var self = this;

        let button_group = document.createElement("div");
        button_group.classList.add("btn-group");
        body.appendChild(button_group);
        
        let delete_button = document.createElement("button");
        delete_button.className = "button-icon bi-trash";
        delete_button.title = "Delete";
        delete_button.addEventListener("click", () => {
            self.controller.delete_screen(this.index);
        });
        button_group.appendChild(delete_button);

        let copy_button = document.createElement("button");
        copy_button.className = "button-icon bi-clipboard";
        copy_button.title = "Copy";
        copy_button.addEventListener("click", () => {
            COPIED_STRING = JSON.stringify(self.export_config());
            navigator.clipboard.writeText(COPIED_STRING);
        });
        button_group.appendChild(copy_button);

        let paste_button = document.createElement("button");
        paste_button.className = "button-icon bi-clipboard-fill";
        paste_button.title = "Paste";
        paste_button.addEventListener("click", () => {
            if (COPIED_STRING != null) {
                let config = JSON.parse(COPIED_STRING);
                self.load_config(config);
                self.element.parentElement.removeChild(self.element);
                self.setup();
            }
        });
        button_group.appendChild(paste_button);

        let animate_button = document.createElement("button");
        animate_button.className = "button-icon bi-play-fill";
        animate_button.title = "Animate";
        animate_button.addEventListener("click", () => {
            if (self.animated) {
                self.animation_offset = 0;
                self.animated = false;
                animate_button.classList.remove("bi-pause-fill");
                animate_button.classList.add("bi-play-fill");
            } else {
                self.animated = true;
                animate_button.classList.add("bi-pause-fill");
                animate_button.classList.remove("bi-play-fill");
                function animate() {
                    if (self.animation_offset >= 1) self.animation_offset -= 1;
                    self.animation_offset += 0.01;
                    self.controller.update();
                    if (self.animated) {
                        requestAnimationFrame(animate);
                    } else {
                        self.animation_offset = 0;
                    }
                }
                animate();
            }
        });
        button_group.appendChild(animate_button);

        let reset_button = document.createElement("button");
        reset_button.className = "button-icon bi-x-circle";
        reset_button.title = "Reset";
        reset_button.addEventListener("click", () => {
            self.controller.reset(self);
        });
        button_group.appendChild(reset_button);

        let panel_inputs = document.createElement("div");
        panel_inputs.classList.add("panel-inputs");
        body.appendChild(panel_inputs);
    }

    setup() {
        this.create_element();
        let container = this.element.querySelector(".panel-inputs");
        this.controller.create_parameter_input(this, container, {
            attribute: "toggled",
            label: "Toggle",
            type: "boolean",
            preset: true,
        });
        this.controller.create_parameter_input(this, container, {
            attribute: "angle_degree",
            label: "Angle",
            type: "range",
            min: 0,
            max: 90,
            step: 1,
            preset: 30,
        });
        this.controller.create_parameter_input(this, container, {
            attribute: "grid_size",
            label: "Grid size",
            type: "range",
            min: 4,
            max: 64,
            step: 1,
            preset: 16,
        });
        this.controller.create_parameter_input(this, container, {
            attribute: "offset_x",
            label: "Offset X",
            type: "range",
            min: 0,
            max: 1,
            step: 0.01,
            preset: 0,
        });
        this.controller.create_parameter_input(this, container, {
            attribute: "offset_y",
            label: "Offset Y",
            type: "range",
            min: 0,
            max: 1,
            step: 0.01,
            preset: 0,
        });
        this.controller.create_parameter_input(this, container, {
            attribute: "interlaced",
            label: "Interlaced",
            type: "boolean",
            preset: true,
        });
        this.controller.create_parameter_input(this, container, {
            attribute: "show_grid",
            label: "Show grid",
            type: "boolean",
            preset: false,
        });
        this.controller.create_parameter_input(this, container, {
            attribute: "collapsed",
            label: "Collapse",
            type: "boolean",
            preset: false,
        });
        this.controller.create_parameter_input(this, container, {
            attribute: "raster_size",
            label: "Dot size ratio",
            type: "range",
            min: 0,
            max: 2,
            step: 0.01,
            preset: 1,
        });
        this.controller.create_parameter_input(this, container, {
            attribute: "color",
            label: "Dot color",
            type: "color",
            preset: "#000000",
        });
        this.controller.create_parameter_input(this, container, {
            attribute: "dot_style",
            label: "Dot shape",
            type: "select",
            options: ["dot", "euclidean", "bayer4", "bayer8", "circle", "ellipse", "horizontal", "vertical", "triangle", "square", "hexagon", "octagon"],
            preset: "circle",
        });
        this.controller.create_parameter_input(this, container, {
            attribute: "channel",
            label: "Channel",
            type: "select",
            options: ["darkness", "red", "green", "blue", "cyan", "magenta", "yellow", "hue", "saturation", "lightness"],
            preset: "darkness",
        });
        this.controller.create_parameter_input(this, container, {
            attribute: "negative",
            label: "Negative",
            type: "boolean",
            preset: false,
        });
        this.controller.create_curve_input(this, container, "tone_curve");
    }

    draw_circle(x, y, intensity) {
        let radius = intensity * this.grid_size / 2 * this.raster_size;
        this.context.beginPath();
        this.context.arc(x, y, radius, 0, 2 * Math.PI);
        this.context.fill();
    }

    draw_ellipse(x, y, intensity) {
        let radius = intensity * this.grid_size / 2 * this.raster_size;
        this.context.beginPath();
        this.context.ellipse(x, y, radius, radius*0.5, -Math.PI / 4, 0, 2 * Math.PI);
        this.context.fill();
    }

    draw_horizontal(x, y, intensity, angle) {
        let height = intensity * this.grid_size * this.raster_size;
        draw_rotated_rectangle(this.context, x, y, this.grid_size, height, angle);
        this.context.fill();
    }

    draw_vertical(x, y, intensity, angle) {
        let width = intensity * this.grid_size * this.raster_size;
        draw_rotated_rectangle(this.context, x, y, width, this.grid_size, angle);
        this.context.fill();
    }

    draw_regular_shape(x, y, intensity, n, angle_offset) {
        let radius = intensity * this.grid_size / 2 * this.raster_size;
        this.context.beginPath();
        this.context.moveTo(x + radius * Math.cos(angle_offset), y + radius* Math.sin(angle_offset));
        for (let k = 0; k <= n; k++) {
            this.context.lineTo(x + radius * Math.cos(2 * k * Math.PI / n + angle_offset), y + radius * Math.sin(2 * k * Math.PI / n + angle_offset));
        }
        this.context.fill();
    }

    draw_texture_pack(x, y, intensity, angle, pack) {
        let texture_index = Math.round(intensity * (pack.length - 1));
        let texture = pack[texture_index];
        texture.draw(this.context, x, y, this.grid_size * this.raster_size, angle);
    }

    draw_dot(x, y, intensity, angle) {
        this.draw_texture_pack(x, y, intensity, angle, DOT_TEXTURE_PACK);
    }

    draw_euclidean(x, y, intensity, angle) {
        this.draw_texture_pack(x, y, intensity, angle, EUCLIDEAN_TEXTURE_PACK);
    }

    draw_bayer4(x, y, intensity, angle) {
        this.draw_texture_pack(x, y, intensity, angle, BAYER4_TEXTURE_PACK);
    }

    draw_bayer8(x, y, intensity, angle) {
        this.draw_texture_pack(x, y, intensity, angle, BAYER8_TEXTURE_PACK);
    }

    draw_square(x, y, intensity, angle) {
        let radius = intensity * this.grid_size * this.raster_size;
        draw_rotated_square(this.context, x, y, radius, angle);
        this.context.fill();
    }

    update() {
        this.canvas.width = this.controller.source.width;
        this.canvas.height = this.controller.source.height;
        this.context.clearRect(0, 0, this.controller.width, this.controller.height);

        if (!this.toggled || this.raster_size == 0) return;

        this.context.fillStyle = this.color;
        let angle = this.angle_degree / 180 * Math.PI;
        let grid_width = this.controller.source.width / this.grid_size;
        let grid_height = this.controller.source.height / this.grid_size / (this.collapsed ? this.raster_size : 1);
        
        let row_start = -grid_height;
        let row_end = 2 * grid_height;
        let col_start = -grid_width;
        let col_end = 2 * grid_width;

        let drawf = (x, y, i) => { this.draw_circle(x, y, i); };
        if (this.dot_style == "dot") drawf = (x, y, i) => { this.draw_dot(x, y, i, angle); };
        if (this.dot_style == "euclidean") drawf = (x, y, i) => { this.draw_euclidean(x, y, i, angle); };
        if (this.dot_style == "bayer4") drawf = (x, y, i) => { this.draw_bayer4(x, y, i, angle); };
        if (this.dot_style == "bayer8") drawf = (x, y, i) => { this.draw_bayer8(x, y, i, angle); };
        if (this.dot_style == "circle") drawf = (x, y, i) => { this.draw_circle(x, y, i); };
        if (this.dot_style == "ellipse") drawf = (x, y, i) => { this.draw_ellipse(x, y, i); };
        if (this.dot_style == "horizontal") drawf = (x, y, i) => { this.draw_horizontal(x, y, i, angle); };
        if (this.dot_style == "vertical") drawf = (x, y, i) => { this.draw_vertical(x, y, i, angle); };
        if (this.dot_style == "triangle") drawf = (x, y, i) => { this.draw_regular_shape(x, y, i, 3, Math.PI); };
        if (this.dot_style == "square") drawf = (x, y, i) => { this.draw_square(x, y, i, angle); };
        if (this.dot_style == "hexagon") drawf = (x, y, i) => { this.draw_regular_shape(x, y, i, 6, Math.PI / 6); };
        if (this.dot_style == "octagon") drawf = (x, y, i) => { this.draw_regular_shape(x, y, i, 8, Math.PI / 8); };

        for (let i = row_start; i < row_end; i++) {
            for (let j = col_start; j < col_end; j++) {
                let coords = this.coords(i, j);
                let x = coords[0];
                let y = coords[1];
                if (x < -this.grid_size || x >= this.controller.source.width + this.grid_size || y < -this.grid_size || y >= this.controller.source.height + this.grid_size) {
                    continue;
                }
                if (this.show_grid) {
                    this.context.strokeStyle = "black";
                    draw_rotated_square(this.context, x, y, this.grid_size, angle);
                    this.context.stroke();
                }
                drawf(x, y, this.intensity_at(x, y));
            }
        }
    }

    coords(i, j) {
        let angle = this.angle_degree / 180 * Math.PI;
        let x_center = this.controller.source.width / 2;
        let y_center = this.controller.source.height / 2;
        let y_base = i * this.grid_size + .5 * this.grid_size + this.offset_y * this.grid_size;
        if (this.collapsed) {
            y_base = i * this.grid_size * this.raster_size + .5 * this.grid_size * this.raster_size;
        }
        let x_base = j * this.grid_size + .5 * this.grid_size + (this.offset_x + this.animation_offset) * this.grid_size;
        if (this.interlaced) {
            x_base += i % 2 * .5 * this.grid_size;
        }
        let x = Math.cos(angle) * (x_base - x_center) + Math.sin(angle) * (y_base - y_center) + x_center;
        let y = -Math.sin(angle) * (x_base - x_center) + Math.cos(angle) * (y_base - y_center) + y_center;
        return [x, y];
    }

    intensity_at(x, y) {
        let intensity = this.controller.source.intensity_at(x, y, this.channel);
        intensity = Math.max(0, Math.min(1, this.tone_curve.f(intensity)));
        if (this.negative) {
            intensity = 1 - intensity;
        }
        return intensity;
    }

    get_data() {
        return this.context.getImageData(0, 0, this.controller.source.width, this.controller.source.height).data;
    }

}


const LOCAL_STORAGE_KEY = "halftone_palette_config";


function compose_normal(lower_layer, upper_layer, k, smooth) {
    let a = upper_layer[k + 3] / 255;
    if (!smooth) a = a > 0 ? 1 : 0;
    let b = 1 - a;
    lower_layer[k] = b * lower_layer[k] + a * upper_layer[k];
    lower_layer[k + 1] = b * lower_layer[k + 1] + a * upper_layer[k + 1];
    lower_layer[k + 2] = b * lower_layer[k + 2] + a * upper_layer[k + 2];
}


function compose_additive(lower_layer, upper_layer, k, smooth) {
    let a = upper_layer[k + 3] / 255;
    if (!smooth) a = a > 0 ? 1 : 0;
    lower_layer[k] = Math.min(255, lower_layer[k] + a * upper_layer[k]);
    lower_layer[k + 1] = Math.min(255, lower_layer[k + 1] + a * upper_layer[k + 1]);
    lower_layer[k + 2] = Math.min(255, lower_layer[k + 2] + a * upper_layer[k + 2]);
}


function compose_subtractive(lower_layer, upper_layer, k, smooth) {
    let a = upper_layer[k + 3] / 255;
    if (!smooth) a = a > 0 ? 1 : 0;
    for (let l = k; l < k+3; l++) {
        let base_color = 255 * (1 - a) + upper_layer[l] * a;
        lower_layer[l] = Math.max(0, lower_layer[l] - (255 - base_color));
    }
}


class Controller {

    constructor(size) {
        this.size = size;
        this.source = new Source(this, this.size);
        this.screens = [];
        this.output = new Output(this, this.size);
        this.auto_update = true;
        this.light_theme = false;
        this.screen_counter = 0;
        this.input_counter = 0;
        this.inputs = [];
        this.curve_inputs = [];
    }

    export_config() {
        let screen_configs = [];
        this.screens.forEach(screen => {
            screen_configs.push(screen.export_config());
        })
        return {
            size: this.size,
            auto_update: this.auto_update,
            light_theme: this.light_theme,
            source: this.source.export_config(),
            screens: screen_configs,
            output: this.output.export_config(),
        }
    }

    save_config_to_storage() {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.export_config()));
    }

    load_config(config) {
        this.size = config.size;
        this.auto_update = config.auto_update;
        this.light_theme = config.light_theme;
        this.source.load_config(config.source);
        this.output.load_config(config.output);
        for (let i = this.screens.length - 1; i >= 0; i--) {
            this.delete_screen_at(i);
        }
        config.screens.forEach(screen_config => {
            let screen = new Screen(this.screen_counter, this);
            this.screen_counter++;
            screen.load_config(screen_config);
            screen.setup();
            this.screens.push(screen);
        });
    }

    load_config_from_storage() {
        let config_string = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (config_string != null) {
            this.load_config(JSON.parse(config_string));
        }
    }

    setup() {
        var self = this;
        let container = document.getElementById("controller-inputs");
        this.create_parameter_input(self, container, {
            attribute: "auto_update",
            label: "Auto update",
            type: "boolean",
            preset: true,
        });
        this.create_parameter_input(self, container, {
            attribute: "light_theme",
            label: "Light theme",
            type: "boolean",
            preset: false,
        });
        this.source.setup();
        this.output.setup();
    }

    update(manual_update=false) {
        if (!manual_update && !this.auto_update) return;
        this.save_config_to_storage();
        if (this.light_theme) {
            document.body.classList.add("light");
        } else {
            document.body.classList.remove("light");
        }
        this.source.update();
        this.curve_inputs.forEach(input => {
            input.element.update(false);
        });
        this.screens.forEach(screen => {
            screen.update();
        });
        this.output.update();
    }

    add_screen(should_update=true) {
        let screen = new Screen(this.screen_counter, this);
        this.screen_counter++;
        screen.setup();
        this.screens.push(screen);
        if (should_update) this.update();
    }

    delete_screen(index) {
        let delete_index = null;
        for (let i = 0; i < this.screens.length; i++) {
            if (this.screens[i].index == index) {
                delete_index = i;
                break;
            }
        }
        this.delete_screen_at(delete_index);
    }

    delete_screen_at(i) {
        if (i == null) return;
        this.screens[i].element.parentElement.removeChild(this.screens[i].element);
        this.screens.splice(i, 1);
        this.update();
    }

    create_parameter_input(ref, container, options) {
        let group = document.createElement("div");
        group.classList.add("input-group");
        if (options.type == "boolean") {
            group.classList.add("input-group-boolean");
        }
        this.input_counter++;
        let input_id = `input-${this.input_counter}`;
        let label = document.createElement("label");
        label.textContent = options.label;
        label.setAttribute("for", input_id);
        group.appendChild(label);
        let input = null;
        let value_span = null;
        var self = this;
        if (options.type == "range") {
            input = document.createElement("input");
            input.type = "range";
            input.min = options.min;
            input.max = options.max;
            input.step = options.step;
            input.value = ref[options.attribute];
            value_span = document.createElement("span");
        } else if (options.type == "color") {
            input = document.createElement("input");
            input.value = ref[options.attribute];
            input.type = "color";
        } else if (options.type == "boolean") {
            input = document.createElement("input");
            input.type = "checkbox";
            if (ref[options.attribute]) input.checked = true;
        } else if (options.type == "select") {
            input = document.createElement("select");
            options.options.forEach(option => {
                let option_element = document.createElement("option");
                option_element.value = option; //TODO: consider using option label/value
                option_element.textContent = option;
                if (ref[options.attribute] == option) {
                    option_element.selected = true;
                }
                input.appendChild(option_element);
            });
        }
        input.id = input_id;
        group.appendChild(input);
        if (value_span != null) {
            value_span.textContent = ` (${ref[options.attribute]})`;
            label.appendChild(value_span);
        }
        input.addEventListener("input", () => {
            let new_value = null;
            if (options.type == "range") {
                if (is_integer(input.step)) {
                    new_value = parseInt(input.value);
                } else {
                    new_value = parseFloat(input.value);
                }
            } else if (options.type == "color") {
                new_value = input.value;
            } else if (options.type == "boolean") {
                new_value = input.checked;
            } else if (options.type == "select") {
                input.querySelectorAll("option").forEach(option => {
                    if (option.selected) {
                        new_value = option.value;
                    }
                });
            }
            ref[options.attribute] = new_value;
            if (value_span != null) value_span.textContent = ` (${new_value})`;
            self.update();
        });
        if (options.type == "range") {
            input.addEventListener("dblclick", () => {
                input.value = options.preset;
                ref[options.attribute] = options.preset;
                if (value_span != null) value_span.textContent = ` (${options.preset})`;
                self.update();
            });
        }
        container.appendChild(group);
        this.inputs.push({
            ref: ref,
            value_span: value_span,
            options: options,
            element: input,
        });
    }

    create_curve_input(ref, container, attribute) {
        var self = this;
        let curve_input = new CurveInput((interpolation) => {
            ref[attribute] = interpolation;
            self.update();
        });
        curve_input.setup(container);
        curve_input.dots = [];
        for (let i = 0; i < ref[attribute].xs.length; i++) {
            let x = ref[attribute].xs[i];
            let y = ref[attribute].ys[i];
            curve_input.dots.push([x, y]);
        }
        curve_input.update(false);
        this.curve_inputs.push({
            ref: ref,
            attribute: attribute,
            element: curve_input,
        });
    }

    reset(filter_ref) {
        this.inputs.forEach(input => {
            if (filter_ref == undefined || filter_ref == input.ref) {
                if (input.options.type == "range" || input.options.type == "color") {
                    input.element.value = input.options.preset;
                } else if (input.options.type == "boolean") {
                    input.element.checked = input.options.preset;
                } else if (input.options.type == "select") {
                    input.element.querySelectorAll("option").forEach(option => {
                        option.selected = option.value == input.options.preset;
                    });
                }
                input.ref[input.options.attribute] = input.options.preset;
                if (input.value_span != null) input.value_span.textContent = ` (${input.options.preset})`;
            }
        });
        this.curve_inputs.forEach(input => {
            if (filter_ref == undefined || filter_ref == input.ref) {
                input.element.dots = [[0, 0], [1, 1]];
                input.ref[input.attribute] = new LagrangeInterpolation([[0, 0], [1, 1]]);
            }
        });
        this.update();
    }

}


function rgb_to_hsl(r, g, b) {
    /* Inputs and outputs are in [0, 1] */
    let cmax = Math.max(r, g, b);
    let cmin = Math.min(r, g, b);
    let delta = cmax - cmin;
    let hue = 0;
    if (delta > 0) {
        if (cmax == r) {
            hue = 60 * ((g - b) / delta % 6);
        } else if (cmax == g) {
            hue = 60 * ((b - r) / delta + 2);
        } else {
            hue = 60 * ((r - g) / delta + 4);
        }
    }
    let lightness = (cmax + cmin) / 2;
    let saturation = delta == 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
    return {
        h: hue / 360,
        s: saturation,
        l: lightness
    };
}


class Source {

    constructor(controller, size) {
        this.controller = controller;
        this.canvas = document.getElementById("source-canvas");
        this.context = this.canvas.getContext("2d");
        this.image = new Image();
        this.image.crossOrigin = "anonymous";
        this.size = size;
        this.width = size;
        this.height = size;
        this.noise_level = 0;
        this.noise_scale = 1;
        this.grey_noise = false;
        this.debug = false;
        var self = this;
        this.image.addEventListener("load", () => { self.on_image_load(); });
        this.data = null;
    }

    setup() {
        let container = document.getElementById("source-panel-inputs");
        var self = this;
        this.controller.create_parameter_input(self, container, {
            attribute: "debug",
            label: "Gradient",
            type: "boolean",
        });
        this.controller.create_parameter_input(self, container, {
            attribute: "noise_level",
            label: "Input noise",
            type: "range",
            min: 0,
            max: 1,
            step: 0.01,
            preset: 0,
        });
        this.controller.create_parameter_input(self, container, {
            attribute: "noise_scale",
            label: "Noise scale",
            type: "range",
            min: 1,
            max: 16,
            step: 1,
            preset: 1,
        });
        this.controller.create_parameter_input(self, container, {
            attribute: "grey_noise",
            label: "Grey noise",
            type: "boolean",
            preset: false,
        });
    }

    export_config() {
        return {
            debug: this.debug,
            noise_level: this.noise_level,
            noise_scale: this.noise_scale,
            grey_noise: this.grey_noise,
        };
    }

    load_config(config) {
        this.debug = config.debug;
        this.noise_level = config.noise_level;
        this.noise_scale = config.noise_scale;
        this.grey_noise = config.grey_noise;
    }

    on_image_load() {
        let aspect_ratio = this.image.width / this.image.height;
        if (aspect_ratio >= 1) {
            this.width = this.size;
            this.height = Math.floor(this.size / aspect_ratio);
        } else {
            this.width = Math.floor(this.size * aspect_ratio);
            this.height = this.size;
        }
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.controller.update();
    }

    update() {
        let context = this.canvas.getContext("2d");
        if (this.debug) {
            for (let j = 0; j < this.width; j++) {
                let grey = Math.round(255 * (1 - j / (this.width - 1)));
                context.fillStyle = `rgb(${grey}, ${grey}, ${grey})`;
                context.fillRect(j, 0, 1, this.height);
            }
        } else {
            context.drawImage(this.image, 0, 0, this.width, this.height);
        }
        let imagedata = context.getImageData(0, 0, this.width, this.height);
        apply_noise(imagedata, this.noise_level, this.noise_scale, this.grey_noise);
        context.putImageData(imagedata, 0, 0);
        this.data = imagedata.data;
    }

    load_url(url) {
        this.image.src = url;
    }

    color_at(i, j) {
        if (i < 0) i = 0;
        if (i >= this.height) i = this.height - 1;
        if (j < 0) j = 0;
        if (j >= this.width) j = this.width - 1;
        let k = ((i * this.width) + j) * 4;
        let color = {};
        color.red = this.data[k] / 255;
        color.green = this.data[k + 1] / 255;
        color.blue = this.data[k + 2] / 255;
        let hsl = rgb_to_hsl(color.red, color.green, color.blue);
        color.alpha = this.data[k + 3] / 255;
        color.brightness = (color.red + color.green + color.blue) / 3;
        color.darkness = 1 - color.brightness;
        color.cyan = 1 - color.red;
        color.magenta = 1 - color.green;
        color.yellow = 1 - color.blue;
        color.hue = hsl.h;
        color.saturation = hsl.s;
        color.lightness = hsl.l;
        return color;
    }

    intensity_at(x, y, channel) {
        let i = Math.floor(y);
        let j = Math.floor(x);
        let color = this.color_at(i, j);
        if (color.alpha == 0) return 0;
        return color[channel];
    }

}

function apply_noise(imagedata, noise_level, noise_scale, grey_noise) {
    if (noise_level == 0) return;
    for (let i = 0; i < imagedata.height; i = i + noise_scale) {
        for (let j = 0; j < imagedata.width; j = j + noise_scale) {
            let noise = null;
            if (grey_noise) {
                let noise_value = Math.floor(Math.random() * 256);
                noise = [noise_value, noise_value, noise_value];
            } else {
                noise = [Math.floor(Math.random() * 256), Math.floor(Math.random() * 256), Math.floor(Math.random() * 256)];
            }
            for (let ii = i; ii < i + noise_scale; ii++) {
                for (let jj = j; jj < j + noise_scale; jj++) {
                    let k = (ii * imagedata.width + jj) * 4;
                    for (let l = k; l < k + 3; l++) {
                        imagedata.data[l] = (1 - noise_level) * imagedata.data[l] + noise_level * noise[l - k];
                    }
                }
            }
        }
    }
}


class Output {

    constructor(controller, size) {
        this.controller = controller;
        this.canvas = document.getElementById("output-canvas");
        this.size = size;
        this.width = this.size;
        this.height = this.size;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.context = this.canvas.getContext("2d");
        this.noise_level = 0;
        this.noise_scale = 1;
        this.smooth = true;
        this.grey_noise = true;
        this.background = "#ffffff";
        this.composition_mode = "normal";
    }

    export_config() {
        return {
            size: this.size,
            noise_level: this.noise_level,
            smooth: this.smooth,
            grey_noise: this.grey_noise,
            composition_mode: this.composition_mode,
            background: this.background,
        }
    }

    load_config(config) {
        this.size = config.size;
        this.noise_level = config.noise_level;
        this.grey_noise = config.grey_noise;
        this.smooth = config.smooth;
        this.composition_mode = config.composition_mode;
        this.background = config.background;
    }

    setup() {
        let container = document.getElementById("output-panel-inputs");
        var self = this;
        this.controller.create_parameter_input(self, container, {
            attribute: "noise_level",
            label: "Output noise",
            type: "range",
            min: 0,
            max: 1,
            step: 0.01,
            preset: 0,
        });
        this.controller.create_parameter_input(self, container, {
            attribute: "noise_scale",
            label: "Noise scale",
            type: "range",
            min: 1,
            max: 16,
            step: 1,
            preset: 1,
        });
        this.controller.create_parameter_input(self, container, {
            attribute: "grey_noise",
            label: "Grey noise",
            type: "boolean",
            preset: true,
        });
        this.controller.create_parameter_input(self, container, {
            attribute: "smooth",
            label: "Anti-aliasing",
            type: "boolean",
            preset: true,
        });
        this.controller.create_parameter_input(self, container, {
            attribute: "background",
            label: "Background color",
            type: "color",
            preset: "#ffffff",
        });
        this.controller.create_parameter_input(self, container, {
            attribute: "composition_mode",
            label: "Color mixing",
            type: "select",
            options: ["normal", "additive", "subtractive"],
            preset: "normal",
        });
    }

    update() {
        this.width = this.controller.source.width;
        this.height = this.controller.source.height;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.context.fillStyle = this.background;
        this.context.fillRect(0, 0, this.width, this.height);
        let imagedata = this.context.getImageData(0, 0, this.width, this.height);
        let composition_function = compose_normal;
        if (this.composition_mode == "additive") {
            composition_function = compose_additive;
        } else if (this.composition_mode == "subtractive") {
            composition_function = compose_subtractive;
        }
        this.controller.screens.forEach(screen => {
            let screen_data = screen.get_data();
            for (let i = 0; i < this.height; i++) {
                for (let j = 0; j < this.width; j++) {
                    let k = (i * this.width + j) * 4;
                    composition_function(imagedata.data, screen_data, k, this.smooth);
                }
            }
        });
        apply_noise(imagedata, this.noise_level, this.noise_scale, this.grey_noise);
        this.context.putImageData(imagedata, 0, 0);
    }

    export() {
        let scale = 1;
        document.getElementById("select-export-scale").querySelectorAll("option").forEach(option => {
            if (option.selected) {
                scale = parseInt(option.value);
            }
        });
        let export_canvas = document.createElement("canvas");
        let width = scale * this.canvas.width;
        let height = scale * this.canvas.height;
        export_canvas.width = width;
        export_canvas.height = height;
        let source_imagedata = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
        let export_context = export_canvas.getContext("2d");
        let export_imagedata = export_context.getImageData(0, 0, width, height);
        for (let i = 0; i < height; i++) {
            for (let j = 0; j < width; j++) {
                let sk = (Math.floor(i / scale) * this.canvas.width + Math.floor(j / scale)) * 4;
                let dk = (i * width + j) * 4;
                for (let l = 0; l < 4; l++) {
                    export_imagedata.data[dk + l] = source_imagedata.data[sk + l];
                }
            }
        }
        export_context.putImageData(export_imagedata, 0, 0);
        export_context.canvas.toBlob((blob) => saveAs(blob, `halftone.${datestring()}.png`))
    }

}


function get_random_picsum_url(size) {
    let width = size;
    let height = size;
    let blob = Math.random();
    if (blob < .333) {
        width = Math.floor(size / 3 * 2);
    } else if (blob < .667) {
        height = Math.floor(size / 3 * 2);
    }
    return `https://picsum.photos/${width}/${height}`;
}


window.addEventListener("load", () => {
    let controller = new Controller(512);
    controller.load_config_from_storage();
    controller.setup();
    if (Math.random() < .5) {
        controller.source.load_url("img/david.png");
    } else {
        controller.source.load_url("img/mountain.jpg");
    }
    document.getElementById("button-add-screen").addEventListener("click", () => { controller.add_screen(); });
    document.getElementById("button-export").addEventListener("click", () => { controller.output.export(); });
    document.getElementById("button-random-image").addEventListener("click", () => {
        controller.source.load_url(get_random_picsum_url(480) + `?random=${parseInt(Math.random() * 1000000)}`);
    });
    document.getElementById("button-update").addEventListener("click", () => { controller.update(true); });
    document.getElementById("input-image").addEventListener("change", () => {
        let image_files = document.getElementById("input-image").files;
        if (image_files.length > 0) {
            controller.source.load_url(URL.createObjectURL(image_files[0]));
        } else {
            alert("Please specify one source!");
            return;
        }
    });
    document.getElementById("button-reset").addEventListener("click", () => { controller.reset(); })
});