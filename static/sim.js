const width = window.innerWidth;
const height = window.innerHeight;

var nodes = [];
var links = [];
var packets = [];

class Matrix {
    values = [];

    length() {
        return this.values.length;
    }

    fill(val) {
        this.values.forEach(a => a.fill(val));
    }

    get(idx_a, idx_b) {
        return this.values[idx_a][idx_b];
    }

    set(idx_a, idx_b, val) {
        this.values[idx_a][idx_b] = val;
    }

    setLast(val) {
        this.set(this.values.length - 1, this.values.length - 1, val);
    }

    setDiagonal(val) {
        if (this.length() <= 0) {
            return;
        }
        let numElem = this.values.length;
        if (Array.isArray(val)) {
            for (let i = 0; i < numElem; i++) {
                this.values[i][i] = val[i];
            }
        } else {
            for (let i = 0; i < numElem; i++) {
                this.values[i][i] = val;
            }
        }
    }

    addDim(defaultValue) {
        this.values.forEach(e => e.push(defaultValue));
        let numElem = this.length() > 0 ? this.values[0].length : 1;
        this.values.push(Array(numElem));
        for (let i = 0; i < numElem; i++) {
            this.values[this.values.length - 1][i] = defaultValue;
        }
    }

    delDim(idx) {
        this.values.splice(idx, 1)
        this.values.forEach(e => e.splice(idx, 1));
    }
}

const adjacency = new Matrix();
const dist = new Matrix();
const distNext = new Matrix();

const simulation = d3
    .forceSimulation(nodes)
    .force('link', d3.forceLink(links).distance(30))
    .force('charge', d3.forceManyBody().distanceMin(15).distanceMax(Math.sqrt(width * width + height * height)).strength(-100))
    .force('center', d3.forceCenter(0, 0).strength(0.2));

// color for links and nodes that are occupied
const loadColor = '#fff'; // '#0d7';

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
    static keyCounter = 0;
    static radius = 10;
    static color = d3.scaleOrdinal(d3.schemeCategory10);
    static strokeWidth = 1.5;

    constructor(x, y) {
        this.key = GraphNode.keyCounter;
        GraphNode.keyCounter++;
        this.x = x;
        this.y = y;
        this.value = 0;
        this.index = nodes.length;
        this.links = []
        this.alive = true;
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
            .attr('stroke-width', GraphNode.strokeWidth)
            .style('fill', GraphNode.getColor)
            .call(setDragPos(simulation));
    }

    static exit(selection) {
        return selection
            .each((n) => {
                n.alive = false;
                // create huge "pulse" node
                svg_background_g
                    .append('circle')
                    .attr('class', 'node.pulse')
                    .attr('r', GraphNode.radius - GraphNode.strokeWidth / 2)
                    .attr('stroke-width', 0)
                    .style('fill', GraphNode.color(n.index))
                    .attr('cx', n.x)
                    .attr("cy", n.y)
                    .attr('opacity', 1)
                    .transition()
                    .duration(1000)
                    .attr('r', GraphNode.radius * 10)
                    .attr('opacity', 0)
                    .remove();

                // create fading node of same size
                svg_background_g
                    .append('circle')
                    .attr('class', 'node.fade')
                    .attr('r', GraphNode.radius - GraphNode.strokeWidth / 2)
                    .attr('stroke-width', 0)
                    .style('fill', loadColor)
                    .attr('cx', n.x)
                    .attr("cy", n.y)
                    .transition()
                    .duration(1000 * 0.5)
                    .attr('r', 0)
                    .remove();
                // create small "pop effect" nodes
                /*for (let i = 0; i < 10; i++) {
                    svg_background_g
                        .append('circle')
                        .attr('class', 'node.pop')
                        .attr('r', Math.max(1, Math.random() * GraphNode.radius / 3))
                        .attr('stroke-width', 0)
                        // TODO: get similar colors, not the exact one
                        .style('fill', GraphNode.color(n.index))
                        .attr('cx', n.x - GraphNode.radius + Math.random() * GraphNode.radius * 2)
                        .attr("cy", n.y - GraphNode.radius + Math.random() * GraphNode.radius * 2)
                        .transition()
                        .duration(100 + Math.random() * 900)
                        .attr('r', 0)
                        .remove();
                }*/
            })
            .remove();
    }

    static getColor(d) {
        if (d.hasOwnProperty('value')) {
            var nodeColorInterpolator = d3.interpolate(
                // loadColor,
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
    static keyCounter = 0;

    /**
     * Create a link between two nodes.
     *
     * @param {GraphNode} a Node a
     * @param {GraphNode} b Node b
     */
    constructor(a, b) {
        this.key = GraphLink.keyCounter;
        GraphLink.keyCounter++;
        this.a = a;
        this.b = b;
        this.a.links.push(this);
        this.b.links.push(this);
        // refresh attributes
        this.refreshIndices();
        this.value = 0;
        this.alive = true;
    }

    refreshIndices() {
        // attribute names with node indices for d3
        this.source = this.a.index;
        this.target = this.b.index;
    }

    static refreshAllIndices() {
        links.forEach(function (link) {
            link.refreshIndices();
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

    static exit(selection) {
        return selection
            .each(l => l.alive = false)
            .attr('stroke-width', 0)
            .attr('opacity', 0)
            .remove();
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
    static keyCounter = 0;
    static ease = d3.easeCubic;
    static width = 10;
    static height = 10;
    static enterAnimationTime = 500;
    static leaveAnimationTime = 250;

    constructor(initialNode, targetNode = null, payload = null) {
        this.key = Packet.keyCounter;
        Packet.keyCounter++;
        this.index = 0;
        this.link = null;
        this.t = 0;
        this.t0 = 0;

        // whether the packet is idling on a node
        this.idle = true;
        this.arrived = false;

        this.node = initialNode;
        this.x = this.node.x;
        this.y = this.node.y;
        this.nextNode = initialNode;
        this.targetNode = targetNode == null ? initialNode : targetNode;
        this.payload = payload;
        // console.log("Packet created at " + initialNode.index)
    }

    static enter(selection) {
        return (
            selection
                .append('circle')
                .attr('class', 'msg')
                .attr('pointer-events', 'none')
                .attr('r', 0)
                .call((e) =>
                    e.transition().duration(Packet.enterAnimationTime).attr('r', GraphNode.radius / 2)
                )
                .attr('stroke', '#fff')
                .attr('stroke-width', 1.5)
                .style('fill', "#000")
        )
    }

    /**
     * Perform a simulation step, selecting the next destination
     */
    step() {
        if (!this.idle) {
            return;
        }

        if (!this.targetNode.alive) {
            // select new target
            this.targetNode = randNode();
        }

        if (this.node == this.targetNode) {
            this.arrived = true;
            this.leave();
            return;
        }

        if (!this.node.alive) {
            this.leave();
            return;
        }

        if (this.node.links.length > 0) {
            // Get to the target node.. 
            this.link = null;
            //console.log("Next node idx at " + this.node.index + ", " + this.targetNode.index + " -- " + nodes.length);
            const nextNodeIdx = distNext.get(this.node.index, this.targetNode.index);
            if (nextNodeIdx == null) {
                // console.log('No shortest path from ' + this.node.index + " to " + this.targetNode.index);
                return;
            }
            this.nextNode = nodes[nextNodeIdx];
            for (let i = 0; i < this.node.links.length; i++) {
                // console.log('Link i=' + i + " of " + this.node.index + " is " + this.node.links[i].getOther(this.node).index);
                if (this.node.links[i].getOther(this.node) == this.nextNode) {
                    this.link = this.node.links[i];
                    break;
                }
            }
            if (this.link == null) {
                // console.log('Could not find path from ' + this.node.index + " to " + this.nextNode.index);
                return;
            }
            // console.log('Next node is ' + this.nextNode.index);
            this.idle = false;
        } else {
            console.log('Deadlock! Node: ' + this.index);
        }
    }

    static exit(selection) {
        return selection
            .transition()
            .duration(Packet.leaveAnimationTime)
            .attr('r', 0)
            .each(p => { if (p.arrived) deleteNode(p.node) })
            .remove();
    }

    leave() {
        // console.log("Packet finished at " + this.node.index)
        this.idle = true;
        packets.splice(packets.indexOf(this), 1);
        updatePackets();
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

        if (!this.link.alive) {
            // packet leaves with destroyed link
            this.leave();
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

var svg_background_g = g.append('g');

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

    // duplicate update of packet positions to force position sync with simulation
    packets.forEach(p => p.update(0))
    svg_msg.attr('cx', (m) => m.x).attr('cy', (m) => m.y);
});

// funs

function getTransformFit(selection) {
    var bounds = selection.node().getBBox();

    if (bounds.width == 0 || bounds.height == 0) {
        // we can't zoom into anything which has size zero..
        return d3.zoomIdentity.translate(bounds.x, bounds.y);
    }

    // TODO: rotate for optimal fit
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

function getCurrentTransform() {
    let nodeTransform = g.node().transform;
    var translate = {
        x: nodeTransform.baseVal[0].matrix.e,
        y: nodeTransform.baseVal[0].matrix.f,
    };
    let scale = nodeTransform.baseVal[1].matrix.a;
    return d3.zoomIdentity.translate(translate.x, translate.y).scale(scale);
}

function updateNodesAndLinks(alpha = 0.5) {
    floydReset();

    svg_node = svg_node.data(nodes, n => n.key).join(
        (enter) => GraphNode.enter(enter),
        (update) => update,
        (exit) => GraphNode.exit(exit)
    );

    svg_link = svg_link.data(links, (l) => l.key).join(
        (enter) => GraphLink.enter(enter),
        (update) => update,
        (exit) => GraphLink.exit(exit)
    );

    // update simulation
    simulation.nodes(nodes);
    simulation.force('link').links(links);
    simulation.alpha(alpha).restart();
}

function updatePackets() {
    svg_msg = svg_msg.data(packets, (p) => p.key).join(
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
var floyd_j = -1;
var floydDone = false;
var floydConnectivityTested = false;

function floydAdvanceIndex() {
    let numNodes = dist.length();
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
        floydDone = true;
        console.log("Floyd done", adjacency, dist, distNext);
    }
}

function floydReset() {
    resetMatrices();
    floydDone = false;
    floyd_k = 0;
    floyd_i = 0;
    floyd_j = -1;
    floydConnectivityTested = false;
}

function floydIteration() {
    floydAdvanceIndex();
    // going over node k is better than the previously calculated distance
    const dij = dist.get(floyd_i, floyd_j);
    const dijk = dist.get(floyd_i, floyd_k) + dist.get(floyd_k, floyd_j);
    if (dij > dijk) {
        // go over node k
        dist.set(floyd_i, floyd_j, dijk);
        distNext.set(floyd_i, floyd_j, distNext.get(floyd_i, floyd_k));
        // console.log("Updated floyd value " + floyd_i + "," + floyd_j + " to " + dist.get(floyd_i, floyd_j));
        // console.log("Distance Floyd", dist.values);
        // console.log("Next Floyd", distNext.values);
    }
}

function spawnNode(x, y, alpha = 0.5) {
    var newNode = new GraphNode(x, y);

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
    let newLinks = [];
    neighbors.forEach((node) => {
        let newLink = new GraphLink(newNode, node);
        newLinks.push(newLink);
        links.push(newLink);
    });

    // adjust distance matrix (with initial values)
    dist.addDim(Infinity)
    dist.setLast(0)
    // console.log("Distance", dist);

    // next node of added node is self, other paths are unknown
    distNext.addDim(null);
    distNext.setLast(distNext.length() - 1);
    // console.log("Next", distNext);

    // increase size of adjacency matrix 
    adjacency.addDim(0);
    newLinks.forEach(l => {
        const i_a = l.a.index;
        const i_b = l.b.index;
        adjacency.set(i_a, i_b, 1);
        adjacency.set(i_b, i_a, 1);
        // TODO: update distances at runtime based on actual distance
        dist.set(i_a, i_b, 1);
        dist.set(i_b, i_a, 1);
        distNext.set(i_a, i_b, i_b);
        distNext.set(i_b, i_a, i_a);
    });
    // console.log("Adjacency", adjacency);

    // update simulation
    updateNodesAndLinks(alpha);
}

function deleteNode(node) {
    if (nodes.length <= 1) {
        // we should not delete the whole graph
        return;
    }
    // console.log("Links before", links, " len ", links.length);
    // console.log("Deleting node", nodes, " len ", nodes.length);

    // update node list
    let nodeIndex = nodes.indexOf(node);
    nodes.splice(nodeIndex, 1);

    GraphNode.refreshAllIndices();

    // delete all links connected to the node
    let newLinks = [];
    // console.log("Links before loop", links, " len ", links.length);
    for (let i = node.links.length - 1; i >= 0; i--) {
        // remove link in this node
        // console.log("Deleting link", i, " of ", node.links.length);
        let link = node.links.splice(i, 1)[0];
        let linkIndex = links.indexOf(link);
        // console.log("Deleting link", link, "index", linkIndex);
        let otherNode = link.getOther(node);
        // remove link in other node
        otherNode.links.splice(otherNode.links.indexOf(link), 1)
        // remove link in list of links (warning: expensive operation)
        links.splice(links.indexOf(link), 1);

        // make sure that the remaining nodes are still connected to other nodes
        // i.e. there are no single-node islands (but there can still be multi-node
        // islands)
        if (otherNode.links.length == 0 && nodes.length > 1) {
            // console.log("Node has no links:", otherNode)
            var newConnectedNode;
            do {
                newConnectedNode = randNode();
            } while (newConnectedNode == otherNode);

            let newLink = new GraphLink(otherNode, randNode());
            newLinks.push(newLink);
            links.push(newLink);
        }
        // console.log("Links after iteration", i, "are", links, " len ", links.length);
        if (node.links.length == 0) {
            break;
        }
    }

    adjacency.delDim(nodeIndex);
    dist.delDim(nodeIndex);
    distNext.delDim(nodeIndex);

    GraphLink.refreshAllIndices();

    // update svg
    updateNodesAndLinks(0.1);
    // console.log("Links afterwards", links, " len ", links.length);
    // console.log("Nodes afterwards", nodes, " len ", nodes.length);
}

function resetMatrices() {
    adjacency.fill(0);

    // reset distance matrix
    dist.fill(Infinity);
    dist.setDiagonal(0);

    // reset next node matrix
    distNext.fill(null);
    distNext.setDiagonal(Array.from(Array(distNext.length()).keys()));

    links.forEach(l => {
        const i_a = l.a.index;
        const i_b = l.b.index;
        adjacency.set(i_a, i_b, 1);
        adjacency.set(i_b, i_a, 1);
        dist.set(i_a, i_b, 1);
        dist.set(i_b, i_a, 1);
        distNext.set(i_a, i_b, i_b);
        distNext.set(i_b, i_a, i_a);
    });
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

var currTransform;
var initialZoom = {
    from: d3.zoomIdentity,
    duration: 1000,
    ease: d3.easeCubic,
    done: false,
    elapsed: 0,
};
function updateZoom(elapsed) {
    if (initialZoom.done) {
        var interTransform = d3.interpolateTransformSvg(
            getCurrentTransform(),
            getTransformFit(svg_node_g)
        );

        currTransform = interTransform(d3.easeCubic(0.2));
        svg.call(zoom.transform, currTransform);
    } else {
        initialZoom.elapsed += elapsed;
        var ratio = Math.min(initialZoom.elapsed / initialZoom.duration, 1);
        var interTransform = d3.interpolateTransformSvg(
            initialZoom.from,
            getTransformFit(svg_node_g)
        );

        currTransform = interTransform(initialZoom.ease(ratio));
        svg.call(zoom.transform, currTransform);

        if (ratio >= 1) {
            initialZoom.done = true;
            initialZoom.elapsed = 0;
            initialZoom.from = getTransformFit(svg_node_g);
        }
    }
}
function resetZoom() {
    initialZoom.done = false;
}

// main loop

// TODO: sync with animation
var lastTime = null;
var elapsed = 0;
var totalPackets = 0;
var targetNodes = 15;
var buildUpElapsed = 0;
const maxNumPackets = 2;
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
    });

    if (initialZoom.done && ((nodes.length >= 10 && packets.length < maxNumPackets) || (nodes.length > 2 && packets.length < 1))) {
        const initialNode = randNode();
        var targetNode;
        do {
            targetNode = randNode();
        } while (targetNode == initialNode);
        packets.push(new Packet(initialNode, targetNode));
        updatePackets();
        totalPackets++;
    }

    buildUpElapsed += elapsed;
    if (nodes.length < targetNodes && buildUpElapsed >= 200) {
        buildUpElapsed = 0;

        var x, y;
        // TODO: Prioritize nodes in larger dimension
        // idea: multiply position by width, height and random factor in (0, 1). Then sort sums, choose first element
        const whr = width / height;
        sortedNodes = nodes.map(n => ({ n, sort: (Math.abs(n.x) * whr + Math.abs(n.y)) * Math.random() })).sort((a, b) => a.sort - b.sort).map(({ n }) => n)
        // if (Math.random() <= 0.9) {
        //     let zoom_origin_x = initialZoom.from.invertX(0);
        //     let zoom_width = initialZoom.from.invertX(width);
        //     let zoom_origin_y = initialZoom.from.invertY(0);
        //     let zoom_height = initialZoom.from.invertY(height);
        //     x = zoom_origin_x - zoom_width / 2 + randRange(0, zoom_width)
        //     y = zoom_origin_y - zoom_height / 2 + randRange(0, zoom_height)
        // }
        // else {
        let randomNode = sortedNodes[sortedNodes.length - 1]; // randNode();
        x = randomNode.x;
        y = randomNode.y;
        //}
        spawnNode(x, y, 0.3);

        if (nodes.length >= targetNodes) {
            targetNodes = randRange(3, 15);
            console.log("New target nodes", targetNodes);
        }
    }

    if (!floydDone) {
        for (let i = 0; i < 50; i++) {
            floydIteration();
        }
    } else if (!floydConnectivityTested) {
        // console.log("Testing connectivity");
        floydConnectivityTested = true;
        var changes = false;

        // randomly connect a node that is not connected

        // randomization from https://stackoverflow.com/a/46545530
        let randomIndices = Array.from(Array(nodes.length).keys())
            .map(value => ({ value, sort: Math.random() }))
            .sort((a, b) => a.sort - b.sort)
            .map(({ value }) => value)


        // console.log("Iterating over random indices ", randomIndices);
        // for each node (in random order)
        for (let i of randomIndices) {
            for (let j of randomIndices) {
                if (i != j && dist.values[i][j] == Infinity) {
                    // no known connection => create link
                    let newLink = new GraphLink(nodes[i], nodes[j]);
                    links.push(newLink);
                    changes = true;
                    break;
                }
            }
            if (changes) {
                break;
            }
        }

        if (changes) {
            console.log("Found isolated nodes");
            updateNodesAndLinks(0.05);
            floydConnectivityTested = false;
        } else {
            console.log("Could not find isolated nodes");
        }
    }

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
