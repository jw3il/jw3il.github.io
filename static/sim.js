const width = window.innerWidth;
const height = window.innerHeight;

var nodes = [];
var links = [];
var packets = [];

var adjacency = [];
var dist = [];
var distPrev = [];

const simulation = d3
    .forceSimulation(nodes)
    .force('link', d3.forceLink(links).distance(30))
    .force('charge', d3.forceManyBody())
    .force('center', d3.forceCenter(0, 0));

// color for links and nodes that are occupied
const loadColor = '#0d7';

/**
 * Drag callbacks from https://observablehq.com/@d3/force-directed-graph to
 * drag elements in a force simulation.
 *
 * @returns drag behavior for dragging elements
 */
function setDragPos() {
    function dragstarted(event) {
        // event.active is the number of active drag gestures
        // => restart simulation only on first drag event (= 0)
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
    }

    function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
    }

    function dragended(event) {
        if (!event.active) simulation.alphaTarget(0.2).restart();
        event.subject.fx = null;
        event.subject.fy = null;
    }

    return d3
        .drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);
}

/**
 * A node in the graph.
 */
class GraphNode {
    static radius = 10;
    static color = d3.scaleOrdinal(d3.schemeCategory10);

    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.value = 0;
        this.index = nodes.length;
        this.links = []
    }

    getDistance(otherNode) {
        const dx = this.x - otherNode.x;
        const dy = this.y - otherNode.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    static refreshAllIndices() {
        nodes.forEach(function (node, idx) {
            node.index = idx;
        });
    }

    static enter(selection) {
        return selection
            .append('circle')
            .attr('class', 'node')
            .attr('r', 0)
            .call((e) =>
                e.transition().duration(500).attr('r', GraphNode.radius)
            )
            .attr('stroke', '#fff')
            .attr('stroke-width', 1.5)
            .style('fill', GraphNode.getColor)
            .call(setDragPos(simulation));
    }

    static getColor(d) {
        if (d.hasOwnProperty('value')) {
            var nodeColorInterpolator = d3.interpolate(
                GraphNode.color(d.index),
                loadColor
            );
            return nodeColorInterpolator(d.value);
        }

        return GraphNode.color(d.index);
    }
}

/**
 * A link in a graph, connecting nodes.
 */
class GraphLink {
    /**
     * Create a link between two nodes.
     *
     * @param {GraphNode} a Node a
     * @param {GraphNode} b Node b
     */
    constructor(a, b) {
        this.a = a;
        this.b = b;
        this.a.links.push(this);
        this.b.links.push(this);
        // refresh attributes
        this.refreshIndices();
        this.value = 0;
    }

    refreshIndices() {
        // attribute names with node indices for d3
        this.source = this.a.index;
        this.target = this.b.index;
    }

    refreshAllIndices() {
        links.forEach(function (link) {
            link.refreshLinkNodeIndices();
        });
    }

    /**
     * Given a node that is connected with the link, returns the other node.
     * @param {*} node a node
     */
    getOther(node) {
        if (this.a == node) {
            return this.b;
        }
        return this.a;
    }

    getLength() {
        return this.a.getDistance(this.b);
    }

    static enter(e) {
        return e
            .append('line')
            .attr('class', 'link')
            .style('stroke', GraphLink.getColor)
            .style('stroke-width', 1);
    }

    static getColor(d) {
        if (d.hasOwnProperty('value')) {
            var linkColorInterpolator = d3.interpolate('#aaa', loadColor);
            return linkColorInterpolator(d.value);
        }

        return '#aaa';
    }
}

/**
 * Packet that moves though the network.
 */
class Packet {
    static ease = d3.easeCubic;
    static width = 10;
    static height = 10;
    static enterAnimationTime = 500;
    static leaveAnimationTime = 250;

    constructor(initialNode, targetNode = null, payload = null) {
        this.index = 0;
        this.link = null;
        this.t = 0;
        this.t0 = 0;
    
        // whether the packet is idling on a node
        this.idle = true;
        
        this.node = initialNode;
        this.x = this.node.x;
        this.y = this.node.y;
        this.nextNode = initialNode;
        this.targetNode = targetNode == null ? initialNode : targetNode;
        this.idle = true;
        this.payload = payload;
        console.log("Packet created at " + initialNode.index)
    }

    static enter(selection) {
        return (
            selection
                /*.append('rect')
                .attr('class', 'msg')
                .attr('width', Packet.width)
                .attr('height', Packet.height)
                .attr('r', 1)
                // make packets unclickable
                // .attr('pointer-events', 'none')
                .style('fill', '#0000')
                .call((e) =>
                    e
                        .transition()
                        .duration(Packet.enterAnimationTime)
                        .style('fill', '#000a')
                )*/
                .append('circle')
                .attr('class', 'msg')
                .attr('r', 0)
                .call((e) =>
                    e.transition().duration(Packet.enterAnimationTime).attr('r', GraphNode.radius / 2)
                )
                .attr('stroke', '#fff')
                .attr('stroke-width', 1.5)
                .style('fill', "#000")
                .attr('cx', (d) => d.x).attr('cy', (d) => d.y)
        )
    }

    /**
     * Perform a simulation step, selecting the next destination
     */
    step() {
        if (!this.idle) {
            return;
        }

        if (this.targetNode != undefined && this.node == this.targetNode) {
            this.leave();
            return;
        }

        if (this.node.links.length > 0) {
            // TODO: Get to the target node.. 
            // const randomLink = randRangeRound(0, this.node.links.length - 1);
            this.link = null;
            //console.log("Next node idx at " + this.node.index + ", " + this.targetNode.index + " -- " + nodes.length);
            const shortestPath = getPath(this.node.index, this.targetNode.index);
            if (shortestPath.length == 0) {
                console.log('No shortest path from ' + this.node.index + " to " + this.targetNode.index);
                return;
            }
            if (shortestPath.length == 1) {
                this.node = this.targetNode;
                this.leave();
                return;
            }
            this.nextNode = nodes[shortestPath[1]];
            for (let i = 0; i < this.node.links.length; i++) {
                // console.log('Link i=' + i + " of " + this.node.index + " is " + this.node.links[i].getOther(this.node).index);
                if (this.node.links[i].getOther(this.node) == this.nextNode) {
                    this.link = this.node.links[i];
                    break;
                }
            }
            if (this.link == null) {
                console.log('Could not find path from ' + this.node.index + " to " + this.nextNode.index);
                return;
            }
            console.log('Next node is ' + this.nextNode.index);
            this.idle = false;
        } else {
            console.log('Deadlock! Node: ' + this.index);
        }
    }

    static exit(selection) {
        return selection //.remove();
            .transition()
            .duration(Packet.leaveAnimationTime)
            // keep updating the position during exit
            .attrTween("cx", (p) => {p.node.x})
            .attrTween("cy", (p) => {p.node.y})
            .attr('r', 0)
            // make transparent
            //.style('fill', '#0000')
            // .delay(Packet.leaveAnimationTime)
            .remove();
    }

    leave() {
        console.log("Packet finished at " + this.node.index)
        this.idle = true;
        packets.splice(packets.indexOf(this), 1);
        updatePackets();
        console.log("Packets: " + packets.length);
    }

    /**
     * Animates the movement of this packet.
     * @param {number} elapsed elapsed time
     */
    update(elapsed) {
        if (this.idle) {
            this.x = this.node.x; // - Packet.width / 2;
            this.y = this.node.y; // - Packet.height / 2;
            return;
        }

        this.t0 += elapsed;
        const enterAnimationRatio = Math.min(
            this.t0 / Packet.enterAnimationTime,
            1
        );
        
        // only increase sim time after the packet has fully entered
        if (this.t0 >= Packet.enterAnimationTime) {
            this.t += elapsed;
        }
        
        // interpolate position between node and nextNode
        var diffX = this.nextNode.x - this.node.x;
        var diffY = this.nextNode.y - this.node.y;

        var distance = Math.sqrt(diffX * diffX + diffY * diffY);
        var ratio = Packet.ease(Math.min(this.t / (distance * 10), 1));

        this.x = this.node.x + ratio * diffX;
        this.y = this.node.y + ratio * diffY;
        // this.x -= Packet.width / 2;
        // this.y -= Packet.height / 2;

        // adjust nodes and link values
        this.node.value = Math.max(
            this.node.value,
            (1 - ratio) * enterAnimationRatio
        );
        this.nextNode.value = Math.max(this.nextNode.value, ratio);
        if (ratio <= 0.5) {
            this.link.value = Math.max(this.link.value, ratio / 0.5);
        } else {
            this.link.value = Math.max(this.link.value, (1 - ratio) / 0.5);
        }

        if (ratio >= 1) {
            this.idle = true;
            this.node = this.nextNode;
            this.t = 0;
        }
    }
}

// build svg

var svg = d3
    .select('#chart')
    .append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', [-width / 2, -height / 2, width, height]);

const zoom = d3.zoom().scaleExtent([0.01, 60]).on('zoom', zoomed);

var g = svg.append('g');

function zoomed({ transform }) {
    g.attr('transform', transform);
}

svg.call(zoom.transform, d3.zoomIdentity);

var svg_link = GraphLink.enter(
    g.append('g').selectAll('line.link').data(links).enter()
);

var svg_node_g = g.append('g');
var svg_node = GraphNode.enter(
    svg_node_g.selectAll('circle.node').data(nodes).enter()
);

var svg_msg = Packet.enter(
    g.append('g').selectAll('circle.msg').data(packets).enter()
);

simulation.on('tick', function () {
    // update link positions
    svg_link
        .attr('x1', (d) => d.source.x)
        .attr('y1', (d) => d.source.y)
        .attr('x2', (d) => d.target.x)
        .attr('y2', (d) => d.target.y);

    // update node positions
    svg_node.attr('cx', (d) => d.x).attr('cy', (d) => d.y);
});

// funs

function getTransformFit(selection) {
    var bounds = selection.node().getBBox();

    if (bounds.width == 0 || bounds.height == 0) {
        // we can't zoom into anything which has size zero..
        return d3.zoomIdentity.translate(bounds.x, bounds.y);
    }

    var scale = Math.min(width / bounds.width, height / bounds.height);
    var center = {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height / 2,
    };
    var translate = {
        x: -scale * center.x,
        y: -scale * center.y,
    };

    return d3.zoomIdentity.translate(translate.x, translate.y).scale(scale);
}

function updateNodesAndLinks() {
    // update simulation
    simulation.nodes(nodes);
    simulation.force('link').links(links);
    simulation.alpha(0.5).restart();

    svg_node = svg_node.data(nodes).join(
        (enter) => GraphNode.enter(enter),
        (update) => update,
        (exit) => exit
    );

    svg_link = svg_link.data(links).join(
        (enter) => GraphLink.enter(enter),
        (update) => update,
        (exit) => exit
    );
}

function updatePackets() {
    svg_msg = svg_msg.data(packets).join(
        (enter) => Packet.enter(enter),
        (update) => update,
        (exit) => Packet.exit(exit) // exit.remove() (?)
    );
}

function tryToDeleteNode(index) {
    var n = nodes[index];
    if (n.value > 0) return false;

    var connectedLinks = links.filter(
        (l) => l.source.index == n.index || l.target.index == n.index
    );

    var hasActiveLink = connectedLinks.find((l) => l.value > 0);

    if (hasActiveLink == undefined) {
        // can remove index
        nodes.splice(index, 1);
        links = links.filter((l) => connectedLinks.indexOf(l) < 0);
        updateNodesAndLinks();
        return true;
    }

    return false;
}

function getRandomCoord(max) {
    return Math.random() * max - max / 2;
}

function randRange(from, to) {
    return Math.random() * (to - from) + from;
}

function randRangeRound(from, to) {
    return Math.round(randRange(from, to));
}

function randNode() {
    return nodes[randRangeRound(0, nodes.length - 1)]
}

function getClosestNodes(node, count) {
    var distances = nodes.map((n) => {
        return {
            index: n.index,
            node: n,
            dist: Math.sqrt(
                Math.pow(n.x - node.x, 2) + Math.pow(n.y - node.y, 2)
            ),
        };
    });
    distances.sort((a, b) => a.dist - b.dist);
    return distances
        .slice(0, Math.min(distances.length, count))
        .map((x) => x.node);
}

var floyd_k = 0;
var floyd_i = 0;
var floyd_j = 0;
function floydAdvanceIndex() {
    let numNodes = dist.length;
    // TODO: reduce number of iterations, our graph is symmetric
    floyd_j += 1;
    if (floyd_j >= numNodes) {
        floyd_i += 1;
        floyd_j = 0;
    }
    if (floyd_i >= numNodes) {
        floyd_k += 1;
        floyd_i = 0;
    }
    if (floyd_k >= numNodes) {
        floyd_k = 0;
    }
}

function floydIteration() {
    // console.log(floyd_j + ", " + floyd_i + ", " + floyd_k);
    // going over node k is better than the previously calculated distance
    if (dist[floyd_i][floyd_j] > dist[floyd_i][floyd_k] + dist[floyd_k][floyd_j]) {
        // go over node k
        dist[floyd_i][floyd_j] = dist[floyd_i][floyd_k] + dist[floyd_k][floyd_j];
        distPrev[floyd_i][floyd_j] = distPrev[floyd_k][floyd_j];
        console.log("Updated floyd value " + floyd_i + "," + floyd_j + " to " + dist[floyd_i][floyd_j] + " and " + distPrev[floyd_i][floyd_j])
        console.log("Distance Floyd", dist);
        console.log("Prev Floyd", distPrev);
    }
    floydAdvanceIndex();
}

function getPath(idx_a, idx_b) {
    if (distPrev[idx_a][idx_b] == null) {
        return [];
    }
    
    var path = [idx_b];
    while (idx_b != idx_a) {
        idx_b = distPrev[idx_a][idx_b];
        if (idx_b == null) {
            return [];
        }
        path.push(idx_b);
    }
    return path.reverse();
}

function spawnNode(x, y) {
    var newNode = new GraphNode(x, y);

    // increase size of adjacency matrix 
    adjacency.forEach(e => e.push(0))
    adjacency.push(Array(nodes.length + 1))

    // select neighbor nodes
    var neighbors = [];
    if (nodes.length > 0) {
        // always select one closest nodes
        neighbors = getClosestNodes(newNode, 1);

        // sometimes add another node
        if (nodes.length > 1 && Math.random() >= 0.7) {
            // randomly add another link
            while (neighbors.length < 2) {
                var neighborCandidate =
                    this.nodes[randRangeRound(0, nodes.length - 1)];
                if (!neighbors.includes(neighborCandidate)) {
                    neighbors.push(neighborCandidate);
                }
            }
        }
    }

    // add new node to list of nodes
    nodes.push(newNode);

    // add links between new node and neighbors
    neighbors.forEach((node) => {
        links.push(new GraphLink(newNode, node));
    });

    // adjust distance matrix (with initial values)
    dist.forEach((val, idx, arr) => val.push(Infinity))
    dist.push(Array(nodes.length))
    const dist_x = dist.length - 1;
    //for (let x = 0; x < dist.length; x++) {
    for (let y = 0; y < dist.length; y++) {
        // distance to self is 0
        dist[dist_x][y] = dist_x == y ? 0 : Infinity;
    }
    //}
    console.log("Distance", dist);

    // next node of added node is self, other paths are unknown
    distPrev.forEach(e => e.push(null));
    distPrev.push(Array(nodes.length));
    //for (let x = 0; x < distPrev.length; x++) {
    for (let y = 0; y < distPrev.length; y++) {
        // set previous node
        distPrev[dist_x][y] = dist_x == y ? x : null;
    }
    //}
    console.log("DistPrev", distPrev);

    // reset and update adjacency and distance matrix
    adjacency.forEach(a => a.fill(0));
    links.forEach(l => {
        // TODO: update distances in adjacency matrix at runtime based on actual distance
        const i_a = l.a.index;
        const i_b = l.b.index;
        adjacency[i_a][i_b] = 1;
        adjacency[i_b][i_a] = 1;
        dist[i_a][i_b] = 1;
        dist[i_b][i_a] = 1;
        console.log("Setting adjacency " + i_a + "," + i_b);
        distPrev[i_a][i_b] = i_a;
        distPrev[i_b][i_a] = i_b;
    });
    console.log("Adjacency", adjacency);

    // update simulation
    updateNodesAndLinks();
}

// initialise the graph

var warmUpDone = false;
var warumUp = setInterval(function () {
    if (nodes.length < 10) {
        spawnNode(getRandomCoord(width), getRandomCoord(height));
    } else {
        clearInterval(warumUp);

        /*for (var i = 0; i < 40; i++) {
            packets.push(
                new Packet(nodes[randRangeRound(0, nodes.length - 1)])
            );
        }*/
        updatePackets();

        warmUpDone = true;
    }
}, 5);

var initialZoom = {
    from: d3.zoomIdentity,
    duration: 1000,
    ease: d3.easeCubic,
    done: false,
    elapsed: 0,
};
function updateZoom(elapsed) {
    if (initialZoom.done) {
        initialZoom.from = getTransformFit(svg_node_g);
        svg.call(zoom.transform, initialZoom.from);
    } else {
        initialZoom.elapsed += elapsed;
        var ratio = Math.min(initialZoom.elapsed / initialZoom.duration, 1);
        var interTransform = d3.interpolateTransformSvg(
            initialZoom.from,
            getTransformFit(svg_node_g)
        );

        svg.call(zoom.transform, interTransform(initialZoom.ease(ratio)));

        if (ratio >= 1) {
            initialZoom.done = true;
            initialZoom.elapsed = 0;
            initialZoom.from = getTransformFit(svg_node_g);
        }
    }
}

// main loop

// TODO: sync with animation
var lastTime = null;
var elapsed = 0;
function step(time) {
    // calculate delta time
    if (lastTime != null) {
        elapsed = time - lastTime;
    }
    lastTime = time;

    updateZoom(elapsed);

    if (!warmUpDone) {
        window.requestAnimationFrame(step);
        return;
    }

    nodes.forEach((n) => {
        n.value *= 0.9;
    });

    links.forEach((l) => {
        l.value *= 0.9;
        // const length = l.getLength();
        // update direct distances (TODO: only upper half for better speed)
        //dist[l.a.index][l.b.index] = length;
        //dist[l.b.index][l.a.index] = length;
    });

    if (nodes.length >= 1 && packets.length < 1) {
        const initialNode = randNode();
        const targetNode = randNode();
        packets.push(new Packet(initialNode, targetNode));
        updatePackets();
    }

    floydIteration();

    // then update packets
    packets.forEach((p) => {
        p.step();
        p.update(elapsed);
    });

    // update svg
    // svg_msg.attr('x', (m) => m.x).attr('y', (m) => m.y);
    svg_msg.attr('cx', (m) => m.x).attr('cy', (m) => m.y);

    svg_node.style('fill', GraphNode.getColor);
    svg_link.style('stroke', GraphLink.getColor);

    // loop
    window.requestAnimationFrame(step);
}

window.requestAnimationFrame(step);
