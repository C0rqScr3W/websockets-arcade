window.tau = Math.PI * 2

window.shipComponent = {
  props: {
    id: String,
    x: Number,
    y: Number,
    angle: Number,
    color: String,
    isPlayer: Boolean
  },
  computed: {
    transforms: function () {
      const transforms = [
        'translate(' + this.x + ', ' + this.y + ')',
        'rotate(' + ((this.angle / window.tau) * 360) + ')',
        'scale(0.01)'
      ]
      return transforms.join('')
    }
  },
  template: `
      <g
        class="ship"
        :class="{playerShip: isPlayer}"
        :transform="transforms"
        :style="'color: ' + color + ';'"
      >
        <polygon points="4,0 -4,-4 -2,0 -4,4"/>
      </g>
    `
}
