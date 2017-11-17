window.tau = Math.PI * 2

window.shipComponent = {
  props: {
    id: String,
    x: Number,
    y: Number,
    angle: Number,
    radius: Number,
    color: String,
    isPlayer: Boolean,
    hit: Boolean
  },
  computed: {
    transforms: function () {
      const transforms = [
        'translate(' + this.x + ', ' + this.y + ')',
        'rotate(' + ((this.angle / window.tau) * 360) + ')',
        'scale(' + this.radius + ')'
      ]
      return transforms.join('')
    }
  },
  template: `
      <g
        class="ship"
        :class="{
          playerShip: isPlayer,
          hit: hit
        }"
        :transform="transforms"
        :style="'color: ' + color + ';'"
      >
        <polygon points="1,0 -1,-1 -0.5,0 -1,1"/>
      </g>
    `
}
